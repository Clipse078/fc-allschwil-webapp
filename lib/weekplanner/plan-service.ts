/**
 * lib/weekplanner/plan-service.ts
 *
 * WEEKPLANNER-01B — domain service for WeekplannerPlan (tenant-defined,
 * week-scoped, named alternative planning variants) and
 * WeekplannerPlanAllocation (their sparse resource-allocation overrides).
 *
 * Architecture:
 *   Tenant → WeekplannerPlan → WeekplannerPlanAllocation → FacilityResource
 *
 * CORE DOMAIN RULE — never duplicates a canonical activity:
 *   "Standardplan" is NOT represented by a row here; it is exactly the
 *   existing canonical allocations already resolved by 01A (see
 *   lib/weekplanner/queries.ts). This service only manages ALTERNATIVE
 *   plans and their sparse overrides. `activityId` intentionally has no DB
 *   relation to TrainingSession/Event — it is validated against those
 *   tenant-scoped tables here, exactly like the existing legacy
 *   Event.pitchCode-by-code resolution technique already used by
 *   queries.ts — so this slice never has to modify those canonical models.
 *
 * "Override by presence, per allocation group" (mirrors
 * lib/training/session-allocation-service.ts): a plan has no override rows
 * for an (activity, group[, participant]) by default — it fully inherits
 * the Standardplan default for that group. The moment ANY override row
 * exists for that exact combination, it fully REPLACES the Standardplan
 * default for that group in THIS plan only. Removing every override row
 * for a group is the reset — there is no separate "use default" mutation.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 *   - Tenant A cannot read or modify Tenant B's plans or overrides.
 */

import { prisma } from "@/lib/db/prisma";
import type { WeekplannerActivityType, WeekplannerAllocationGroup } from "@prisma/client";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import { zonedDateKey, WEEKPLANNER_DEFAULT_TIMEZONE } from "./date";
import type {
  WeekplannerPlanDto,
  WeekplannerPlanAllocationDto,
  WeekplannerPlanActivityOverrideDto,
  CreateWeekplannerPlanInput,
  CreateWeekplannerPlanAllocationInput,
  SetWeekplannerPlanActivityTimeOverrideInput,
} from "./plan-types";
import {
  WeekplannerPlanNotFoundError,
  WeekplannerPlanValidationError,
  WeekplannerPlanNameConflictError,
  WeekplannerPlanArchivedError,
  WeekplannerPlanDeleteUnsafeError,
  WeekplannerPlanAllocationNotFoundError,
  WeekplannerPlanAllocationDuplicateError,
  WeekplannerPlanAllocationActivityNotFoundError,
  WeekplannerPlanAllocationInvalidParticipantError,
  WeekplannerPlanAllocationGroupMismatchError,
  WeekplannerPlanAllocationResourceNotFoundError,
  WeekplannerPlanAllocationArchivedResourceError,
  WeekplannerPlanAllocationArchivedFacilityError,
  WeekplannerPlanTimeOverrideInvalidRangeError,
} from "./plan-errors";

const MAX_NAME_LENGTH = 100;
const WEEK_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ── Row types ─────────────────────────────────────────────────────────────

type PlanRow = {
  id: string;
  tenantId: string;
  weekId: string;
  name: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  _count?: { allocations: number };
};

type AllocationRow = {
  id: string;
  tenantId: string;
  weekplannerPlanId: string;
  activityType: WeekplannerActivityType;
  activityId: string;
  allocationGroup: WeekplannerAllocationGroup;
  participantId: string;
  facilityResourceId: string;
  notes: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  facilityResource: {
    name: string;
    code: string;
    type: string;
    facilityId: string;
    facility: { name: string };
  };
};

const allocationInclude = {
  facilityResource: {
    select: {
      name: true,
      code: true,
      type: true,
      facilityId: true,
      facility: { select: { name: true } },
    },
  },
} as const;

// ── DTO mappers ───────────────────────────────────────────────────────────

function planToDto(row: PlanRow): WeekplannerPlanDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    weekId: row.weekId,
    name: row.name,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function allocationToDto(row: AllocationRow): WeekplannerPlanAllocationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    weekplannerPlanId: row.weekplannerPlanId,
    activityType: row.activityType,
    activityId: row.activityId,
    allocationGroup: row.allocationGroup,
    participantId: row.participantId,
    facilityResourceId: row.facilityResourceId,
    facilityResourceName: row.facilityResource.name,
    facilityResourceCode: row.facilityResource.code,
    facilityResourceType: row.facilityResource.type,
    facilityId: row.facilityResource.facilityId,
    facilityName: row.facilityResource.facility.name,
    notes: row.notes,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Validation helpers ────────────────────────────────────────────────────

function validateWeekId(weekId: string): string {
  const trimmed = weekId.trim();
  if (!WEEK_ID_PATTERN.test(trimmed)) {
    throw new WeekplannerPlanValidationError(
      `weekId must be a "YYYY-MM-DD" Monday date, got: "${weekId}"`,
    );
  }
  return trimmed;
}

function validatePlanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new WeekplannerPlanValidationError("Plan name must not be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new WeekplannerPlanValidationError(`Plan name must not exceed ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

/** Normalises participantId per the empty-string sentinel convention — see prisma/schema.prisma doc comment. */
function normalizeParticipantId(
  activityType: WeekplannerActivityType,
  allocationGroup: WeekplannerAllocationGroup,
  participantId: string | null | undefined,
): string {
  const requiresParticipant = activityType === "TOURNAMENT" && allocationGroup === "DRESSING_ROOM";
  const trimmed = participantId?.trim() ?? "";

  if (requiresParticipant && !trimmed) {
    throw new WeekplannerPlanAllocationInvalidParticipantError(
      "participantId is required for TOURNAMENT dressing-room (Garderobe) overrides",
    );
  }
  if (!requiresParticipant && trimmed) {
    throw new WeekplannerPlanAllocationInvalidParticipantError(
      `participantId must be empty for ${activityType}/${allocationGroup} overrides`,
    );
  }
  return trimmed;
}

/** Validates the referenced canonical activity exists, in this tenant, with the expected type. Never a DB relation — see module doc comment. */
async function requireActivityInTenant(
  tenantId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<void> {
  if (activityType === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: { id: activityId, tenantId },
      select: { id: true },
    });
    if (!session) throw new WeekplannerPlanAllocationActivityNotFoundError(activityType, activityId);
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: activityId, tenantId, type: activityType },
    select: { id: true },
  });
  if (!event) throw new WeekplannerPlanAllocationActivityNotFoundError(activityType, activityId);
}

/**
 * WEEKPLANNER-01D — validates the referenced canonical activity exists (see
 * requireActivityInTenant above) AND returns its canonical start/end
 * instant, needed to (a) resolve the effective fallback time and (b)
 * enforce that a time override never shifts an activity to another
 * calendar day (anti-drift — see WeekplannerPlanTimeOverrideInvalidRangeError).
 */
async function requireActivityWindow(
  tenantId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<{ startAt: Date; endAt: Date }> {
  if (activityType === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: { id: activityId, tenantId },
      select: { startAt: true, endAt: true },
    });
    if (!session) throw new WeekplannerPlanAllocationActivityNotFoundError(activityType, activityId);
    return session;
  }

  const event = await prisma.event.findFirst({
    where: { id: activityId, tenantId, type: activityType },
    select: { startAt: true, endAt: true },
  });
  if (!event) throw new WeekplannerPlanAllocationActivityNotFoundError(activityType, activityId);
  return { startAt: event.startAt, endAt: event.endAt ?? event.startAt };
}

/** For TOURNAMENT+DRESSING_ROOM only: validates the participant belongs to this tenant and this tournament Event. */
async function requireParticipantInTenant(
  tenantId: string,
  eventId: string,
  participantId: string,
): Promise<void> {
  const participant = await prisma.tournamentParticipant.findFirst({
    where: { id: participantId, tenantId, eventId },
    select: { id: true },
  });
  if (!participant) {
    throw new WeekplannerPlanAllocationActivityNotFoundError("TOURNAMENT participant", participantId);
  }
}

async function requirePlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await prisma.weekplannerPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) throw new WeekplannerPlanNotFoundError(planId);
  return plan;
}

async function requireActivePlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await requirePlan(tenantId, planId);
  if (plan.archivedAt) throw new WeekplannerPlanArchivedError(planId);
  return plan;
}

async function requireNameAvailable(
  tenantId: string,
  weekId: string,
  name: string,
  excludePlanId?: string,
): Promise<void> {
  const normalized = name.toLowerCase();
  const existing = await prisma.weekplannerPlan.findMany({
    where: { tenantId, weekId, archivedAt: null, ...(excludePlanId ? { id: { not: excludePlanId } } : {}) },
    select: { id: true, name: true },
  });
  if (existing.some((row) => row.name.toLowerCase() === normalized)) {
    throw new WeekplannerPlanNameConflictError(name);
  }
}

async function requireAllocation(tenantId: string, allocationId: string): Promise<AllocationRow> {
  const allocation = await prisma.weekplannerPlanAllocation.findFirst({
    where: { id: allocationId, tenantId },
    include: allocationInclude,
  });
  if (!allocation) throw new WeekplannerPlanAllocationNotFoundError(allocationId);
  return allocation as unknown as AllocationRow;
}

// ── Public API — WeekplannerPlan lifecycle ─────────────────────────────────

/** Lists non-archived plans for a tenant+week, ordered by creation (oldest first). Never includes a "Standardplan" row — see module doc comment. */
export async function listWeekplannerPlans(
  tenantId: string,
  weekId: string,
): Promise<WeekplannerPlanDto[]> {
  const plans = await prisma.weekplannerPlan.findMany({
    where: { tenantId, weekId, archivedAt: null },
    orderBy: [{ createdAt: "asc" }],
  });
  return plans.map((p) => planToDto(p));
}

/** Retrieves a single plan by id, tenant-scoped. Throws WeekplannerPlanNotFoundError if missing or cross-tenant. */
export async function getWeekplannerPlan(tenantId: string, planId: string): Promise<WeekplannerPlanDto> {
  return planToDto(await requirePlan(tenantId, planId));
}

export async function createWeekplannerPlan(
  tenantId: string,
  input: CreateWeekplannerPlanInput,
): Promise<WeekplannerPlanDto> {
  const weekId = validateWeekId(input.weekId);
  const name = validatePlanName(input.name);
  await requireNameAvailable(tenantId, weekId, name);

  try {
    const plan = await prisma.weekplannerPlan.create({
      data: {
        tenantId,
        weekId,
        name,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
    return planToDto(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("Unique")) {
      throw new WeekplannerPlanNameConflictError(name);
    }
    throw err;
  }
}

export async function renameWeekplannerPlan(
  tenantId: string,
  planId: string,
  name: string,
): Promise<WeekplannerPlanDto> {
  const existing = await requireActivePlan(tenantId, planId);
  const validated = validatePlanName(name);
  await requireNameAvailable(tenantId, existing.weekId, validated, planId);

  try {
    const plan = await prisma.weekplannerPlan.update({
      where: { id: planId },
      data: { name: validated },
    });
    return planToDto(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("Unique")) {
      throw new WeekplannerPlanNameConflictError(validated);
    }
    throw err;
  }
}

/** Soft-deletes (archives) a plan. Hides it from the plan selector while preserving its overrides for history. */
export async function archiveWeekplannerPlan(tenantId: string, planId: string): Promise<WeekplannerPlanDto> {
  await requirePlan(tenantId, planId);
  const plan = await prisma.weekplannerPlan.update({
    where: { id: planId },
    data: { archivedAt: new Date() },
  });
  return planToDto(plan);
}

/**
 * Hard-deletes a plan. Only "safe" (per product spec) when the plan holds
 * zero WeekplannerPlanAllocation rows — otherwise throws
 * WeekplannerPlanDeleteUnsafeError, guiding the caller to archive instead.
 */
export async function deleteWeekplannerPlan(tenantId: string, planId: string): Promise<void> {
  await requirePlan(tenantId, planId);
  const overrideCount = await prisma.weekplannerPlanAllocation.count({
    where: { tenantId, weekplannerPlanId: planId },
  });
  if (overrideCount > 0) {
    throw new WeekplannerPlanDeleteUnsafeError(planId);
  }
  await prisma.weekplannerPlan.delete({ where: { id: planId } });
}

// ── Public API — WeekplannerPlanAllocation (overrides) ────────────────────

export async function listWeekplannerPlanAllocations(
  tenantId: string,
  planId: string,
): Promise<WeekplannerPlanAllocationDto[]> {
  await requirePlan(tenantId, planId);
  const allocations = await prisma.weekplannerPlanAllocation.findMany({
    where: { tenantId, weekplannerPlanId: planId },
    include: allocationInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return allocations.map((a) => allocationToDto(a as unknown as AllocationRow));
}

export async function getWeekplannerPlanAllocation(
  tenantId: string,
  allocationId: string,
): Promise<WeekplannerPlanAllocationDto> {
  return allocationToDto(await requireAllocation(tenantId, allocationId));
}

export async function createWeekplannerPlanAllocation(
  tenantId: string,
  input: CreateWeekplannerPlanAllocationInput,
): Promise<WeekplannerPlanAllocationDto> {
  const { weekplannerPlanId, activityType, activityId, allocationGroup, facilityResourceId, notes, displayOrder } =
    input;

  await requireActivePlan(tenantId, weekplannerPlanId);
  await requireActivityInTenant(tenantId, activityType, activityId);

  const participantId = normalizeParticipantId(activityType, allocationGroup, input.participantId);
  if (participantId) {
    await requireParticipantInTenant(tenantId, activityId, participantId);
  }

  const resource = await prisma.facilityResource.findFirst({
    where: { id: facilityResourceId, tenantId },
    select: {
      id: true,
      type: true,
      status: true,
      facility: { select: { id: true, status: true } },
    },
  });
  if (!resource) throw new WeekplannerPlanAllocationResourceNotFoundError(facilityResourceId);
  if (resource.status === "ARCHIVED") {
    throw new WeekplannerPlanAllocationArchivedResourceError(facilityResourceId);
  }
  if (resource.facility.status === "ARCHIVED") {
    throw new WeekplannerPlanAllocationArchivedFacilityError(resource.facility.id);
  }

  const resourceGroup = classifyFacilityResourceType(resource.type);
  if (
    (allocationGroup === "PITCH_HALL" && resourceGroup !== "PITCH_HALL") ||
    (allocationGroup === "DRESSING_ROOM" && resourceGroup !== "DRESSING_ROOM")
  ) {
    throw new WeekplannerPlanAllocationGroupMismatchError(
      `FacilityResource "${facilityResourceId}" (type ${resource.type}) does not belong to allocation group ${allocationGroup}`,
    );
  }

  let order = displayOrder;
  if (order === undefined) {
    const maxRow = await prisma.weekplannerPlanAllocation.aggregate({
      where: { weekplannerPlanId, activityType, activityId, allocationGroup, participantId },
      _max: { displayOrder: true },
    });
    order = (maxRow._max.displayOrder ?? -1) + 1;
  }

  try {
    const allocation = await prisma.weekplannerPlanAllocation.create({
      data: {
        tenantId,
        weekplannerPlanId,
        activityType,
        activityId,
        allocationGroup,
        participantId,
        facilityResourceId,
        notes: notes ?? null,
        displayOrder: order,
      },
      include: allocationInclude,
    });
    return allocationToDto(allocation as unknown as AllocationRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("Unique")) {
      throw new WeekplannerPlanAllocationDuplicateError();
    }
    throw err;
  }
}

/**
 * Deletes one override row. When this removes the last override row for an
 * (activity, group[, participant]) combination, that group reverts to the
 * Standardplan default for this plan only — no separate reset mutation.
 */
export async function deleteWeekplannerPlanAllocation(tenantId: string, allocationId: string): Promise<void> {
  await requireAllocation(tenantId, allocationId);
  await prisma.weekplannerPlanAllocation.delete({ where: { id: allocationId } });
}

// ── Public API — WeekplannerPlanActivityOverride (WEEKPLANNER-01D time overrides) ──

type TimeOverrideRow = {
  id: string;
  tenantId: string;
  weekplannerPlanId: string;
  activityType: WeekplannerActivityType;
  activityId: string;
  overrideStartAt: Date | null;
  overrideEndAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function timeOverrideToDto(row: TimeOverrideRow): WeekplannerPlanActivityOverrideDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    weekplannerPlanId: row.weekplannerPlanId,
    activityType: row.activityType,
    activityId: row.activityId,
    overrideStartAt: row.overrideStartAt ? row.overrideStartAt.toISOString() : null,
    overrideEndAt: row.overrideEndAt ? row.overrideEndAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Validates a single override instant falls on the SAME Europe/Zurich calendar day as the canonical instant it replaces — never a day/date override. */
function requireSameCalendarDay(overrideAt: Date, canonicalAt: Date, label: string): void {
  if (zonedDateKey(overrideAt, WEEKPLANNER_DEFAULT_TIMEZONE) !== zonedDateKey(canonicalAt, WEEKPLANNER_DEFAULT_TIMEZONE)) {
    throw new WeekplannerPlanTimeOverrideInvalidRangeError(
      `${label} must stay on the activity's canonical calendar day — moving an activity to another day is not supported here`,
    );
  }
}

function parseOverrideInstant(value: string, label: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new WeekplannerPlanTimeOverrideInvalidRangeError(`${label} must be a valid ISO date-time`);
  }
  return parsed;
}

export async function listWeekplannerPlanActivityOverrides(
  tenantId: string,
  planId: string,
): Promise<WeekplannerPlanActivityOverrideDto[]> {
  await requirePlan(tenantId, planId);
  const rows = await prisma.weekplannerPlanActivityOverride.findMany({
    where: { tenantId, weekplannerPlanId: planId },
  });
  return rows.map((row) => timeOverrideToDto(row));
}

export async function getWeekplannerPlanActivityOverride(
  tenantId: string,
  planId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<WeekplannerPlanActivityOverrideDto | null> {
  await requirePlan(tenantId, planId);
  const row = await prisma.weekplannerPlanActivityOverride.findFirst({
    where: { tenantId, weekplannerPlanId: planId, activityType, activityId },
  });
  return row ? timeOverrideToDto(row) : null;
}

/**
 * Sets (upserts) this plan's start/end time override for one canonical
 * activity — TRAINING, MATCH, or TOURNAMENT. Either field may be omitted/
 * null to keep inheriting the canonical Standardplan value for that side
 * only (sparse override). Passing both as null/undefined clears the
 * override entirely (returns null) — equivalent to "Standardzeit
 * verwenden" — with no separate reset mutation, mirroring
 * WeekplannerPlanAllocation's "override by presence" convention.
 *
 * Never mutates TrainingSession.startAt/endAt or Event.startAt/endAt, never
 * duplicates the activity, and never moves it to another calendar day
 * (enforced below against the canonical window).
 */
export async function setWeekplannerPlanActivityTimeOverride(
  tenantId: string,
  input: SetWeekplannerPlanActivityTimeOverrideInput,
): Promise<WeekplannerPlanActivityOverrideDto | null> {
  const { weekplannerPlanId, activityType, activityId } = input;

  await requireActivePlan(tenantId, weekplannerPlanId);
  const canonical = await requireActivityWindow(tenantId, activityType, activityId);

  const hasStart = input.overrideStartAt !== undefined && input.overrideStartAt !== null;
  const hasEnd = input.overrideEndAt !== undefined && input.overrideEndAt !== null;

  if (!hasStart && !hasEnd) {
    await prisma.weekplannerPlanActivityOverride
      .delete({ where: { weekplannerPlanId_activityType_activityId: { weekplannerPlanId, activityType, activityId } } })
      .catch(() => undefined);
    return null;
  }

  const overrideStartAt = hasStart ? parseOverrideInstant(input.overrideStartAt as string, "Start") : null;
  const overrideEndAt = hasEnd ? parseOverrideInstant(input.overrideEndAt as string, "Ende") : null;

  if (overrideStartAt) requireSameCalendarDay(overrideStartAt, canonical.startAt, "Start");
  if (overrideEndAt) requireSameCalendarDay(overrideEndAt, canonical.endAt, "Ende");

  const effectiveStart = overrideStartAt ?? canonical.startAt;
  const effectiveEnd = overrideEndAt ?? canonical.endAt;
  if (effectiveEnd.getTime() <= effectiveStart.getTime()) {
    throw new WeekplannerPlanTimeOverrideInvalidRangeError("Ende muss nach dem Start liegen");
  }

  const row = await prisma.weekplannerPlanActivityOverride.upsert({
    where: { weekplannerPlanId_activityType_activityId: { weekplannerPlanId, activityType, activityId } },
    create: {
      tenantId,
      weekplannerPlanId,
      activityType,
      activityId,
      overrideStartAt,
      overrideEndAt,
    },
    update: {
      overrideStartAt,
      overrideEndAt,
    },
  });

  return timeOverrideToDto(row);
}

/** Clears this plan's time override for one activity — "Standardzeit verwenden". Idempotent: a no-op when no override exists. */
export async function clearWeekplannerPlanActivityTimeOverride(
  tenantId: string,
  planId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
): Promise<void> {
  await requireActivePlan(tenantId, planId);
  await prisma.weekplannerPlanActivityOverride
    .delete({
      where: { weekplannerPlanId_activityType_activityId: { weekplannerPlanId: planId, activityType, activityId } },
    })
    .catch(() => undefined);
}
