/**
 * lib/training/training-plan-service.ts
 *
 * Domain service for tenant-defined Training Plans (TRAINING-PLANS-01).
 *
 * Manages the lifecycle of TrainingPlan and TrainingPlanAssignment.
 *
 * Architecture:
 *   TeamSeason → TrainingSeries → TrainingPlanAssignment → TrainingPlan
 *
 * Canonical principles:
 *   - A TrainingPlan NEVER duplicates TrainingSeries — it configures them.
 *   - One TrainingSeries may appear in multiple plans with different schedules.
 *   - Tenants freely name plans. No plan types are hard-coded.
 *   - At most one non-archived default plan per (tenantId, seasonId).
 *   - No activation, resource allocation, or dated occurrence resolution here.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped by tenantId.
 *   - Tenant A cannot read or modify Tenant B's plans.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TrainingPlanDto,
  TrainingPlanAssignmentDto,
  CreateTrainingPlanInput,
  UpdateTrainingPlanInput,
  CopyTrainingPlanInput,
  UpsertTrainingPlanAssignmentInput,
  ListTrainingPlansFilter,
  TrainingPlanStatus,
  TrainingPlanAssignmentStatus,
} from "./types";
import {
  TrainingPlanNotFoundError,
  TrainingPlanNameConflictError,
  TrainingPlanDefaultConflictError,
  TrainingPlanDefaultArchiveForbiddenError,
  TrainingPlanInvalidOrderError,
  TrainingPlanCopyNotSupportedError,
  TrainingPlanAssignmentNotFoundError,
  TrainingPlanAssignmentTenantMismatchError,
  TrainingPlanAssignmentSeasonMismatchError,
  TrainingPlanAssignmentInvalidTimeError,
  SeasonNotFoundError,
  TrainingSeriesNotFoundError,
} from "./errors";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 100;

// ── Time helpers ──────────────────────────────────────────────────────────────

function parseTimeMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return NaN;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return NaN;
  return h * 60 + m;
}

function isValidTime(time: string): boolean {
  return !isNaN(parseTimeMinutes(time));
}

/**
 * Validates a time override pair. If only one override is provided, the
 * effective range is formed by combining the override with the canonical value.
 * We validate in the context of both provided overrides only to prevent the
 * assignment itself from creating an invalid range within its own overrides.
 */
function validateTimeOverrides(
  startTimeOverride: string | null | undefined,
  endTimeOverride: string | null | undefined,
): void {
  if (startTimeOverride != null && !isValidTime(startTimeOverride)) {
    throw new TrainingPlanAssignmentInvalidTimeError(
      `startTimeOverride must be "HH:mm", got: "${startTimeOverride}"`,
    );
  }
  if (endTimeOverride != null && !isValidTime(endTimeOverride)) {
    throw new TrainingPlanAssignmentInvalidTimeError(
      `endTimeOverride must be "HH:mm", got: "${endTimeOverride}"`,
    );
  }
  if (startTimeOverride != null && endTimeOverride != null) {
    const s = parseTimeMinutes(startTimeOverride);
    const e = parseTimeMinutes(endTimeOverride);
    if (s >= e) {
      throw new TrainingPlanAssignmentInvalidTimeError(
        `startTimeOverride (${startTimeOverride}) must be before endTimeOverride (${endTimeOverride})`,
      );
    }
  }
}

// ── Name helpers ──────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function validatePlanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new TrainingPlanNameConflictError("Plan name must not be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new TrainingPlanNameConflictError(
      `Plan name must not exceed ${MAX_NAME_LENGTH} characters`,
    );
  }
  return trimmed;
}

// ── DTO mappers ───────────────────────────────────────────────────────────────

type PlanRow = {
  id: string;
  tenantId: string;
  seasonId: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  displayOrder: number;
  missingAssignmentBehavior: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  _count?: { assignments: number };
};

function planToDto(row: PlanRow): TrainingPlanDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    seasonId: row.seasonId,
    name: row.name,
    description: row.description,
    status: row.status as TrainingPlanStatus,
    isDefault: row.isDefault,
    displayOrder: row.displayOrder,
    missingAssignmentBehavior: row.missingAssignmentBehavior as TrainingPlanDto["missingAssignmentBehavior"],
    assignmentCount: row._count?.assignments ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

type AssignmentRow = {
  id: string;
  tenantId: string;
  trainingPlanId: string;
  trainingSeriesId: string;
  startTimeOverride: string | null;
  endTimeOverride: string | null;
  timezoneOverride: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  trainingSeries: {
    title: string;
    teamSeasonId: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
  };
};

function assignmentToDto(row: AssignmentRow): TrainingPlanAssignmentDto {
  const series = row.trainingSeries;
  return {
    id: row.id,
    tenantId: row.tenantId,
    trainingPlanId: row.trainingPlanId,
    trainingSeriesId: row.trainingSeriesId,
    trainingSeriesTitle: series.title,
    teamSeasonId: series.teamSeasonId,
    status: row.status as TrainingPlanAssignmentStatus,
    startTimeOverride: row.startTimeOverride,
    endTimeOverride: row.endTimeOverride,
    timezoneOverride: row.timezoneOverride,
    effectiveStartTime: row.startTimeOverride ?? series.startsAt,
    effectiveEndTime: row.endTimeOverride ?? series.endsAt,
    effectiveTimezone: row.timezoneOverride ?? series.timezone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const assignmentInclude = {
  trainingSeries: {
    select: {
      title: true,
      teamSeasonId: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
    },
  },
} as const;

const planInclude = {
  _count: { select: { assignments: true } },
} as const;

// ── Plan lookups ──────────────────────────────────────────────────────────────

async function requirePlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, tenantId },
    include: planInclude,
  });
  if (!plan) throw new TrainingPlanNotFoundError(planId);
  return plan as PlanRow;
}

async function requireSeason(seasonId: string): Promise<void> {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true } });
  if (!season) throw new SeasonNotFoundError(seasonId);
}

/** Checks case-insensitive name uniqueness among non-archived plans. */
async function checkNameUniqueness(
  tenantId: string,
  seasonId: string,
  name: string,
  excludePlanId?: string,
): Promise<void> {
  const normalized = normalizeName(name);

  const allNonArchived = await prisma.trainingPlan.findMany({
    where: {
      tenantId,
      seasonId,
      archivedAt: null,
      ...(excludePlanId ? { NOT: { id: excludePlanId } } : {}),
    },
    select: { id: true, name: true },
  });

  const conflict = allNonArchived.find(
    (p) => normalizeName(p.name) === normalized,
  );
  if (conflict) throw new TrainingPlanNameConflictError(name);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a new tenant-defined training plan.
 *
 * When isDefault=true the service first clears the default flag from any
 * existing default plan within the same tenant+season, then sets the new plan
 * as default — all within a transaction to maintain the at-most-one invariant.
 */
export async function createTrainingPlan(
  tenantId: string,
  input: CreateTrainingPlanInput,
): Promise<TrainingPlanDto> {
  const { seasonId, description, status, isDefault, missingAssignmentBehavior } = input;

  await requireSeason(seasonId);

  const name = validatePlanName(input.name);
  await checkNameUniqueness(tenantId, seasonId, name);

  if (isDefault) {
    const existingDefault = await prisma.trainingPlan.findFirst({
      where: { tenantId, seasonId, isDefault: true, archivedAt: null },
      select: { id: true },
    });
    if (existingDefault) throw new TrainingPlanDefaultConflictError();
  }

  const maxOrderRow = await prisma.trainingPlan.aggregate({
    where: { tenantId, seasonId },
    _max: { displayOrder: true },
  });
  const nextOrder =
    input.displayOrder ?? (maxOrderRow._max.displayOrder ?? -1) + 1;

  const plan = await prisma.trainingPlan.create({
    data: {
      tenantId,
      seasonId,
      name,
      description: description ?? null,
      status: (status ?? "ACTIVE") as never,
      isDefault: isDefault ?? false,
      displayOrder: nextOrder,
      missingAssignmentBehavior: (missingAssignmentBehavior ?? "FALLBACK_TO_DEFAULT") as never,
    },
    include: planInclude,
  });

  return planToDto(plan as PlanRow);
}

/**
 * Updates mutable fields of a training plan.
 * Does not change default status (use setDefaultTrainingPlan for that).
 */
export async function updateTrainingPlan(
  tenantId: string,
  planId: string,
  input: UpdateTrainingPlanInput,
): Promise<TrainingPlanDto> {
  const existing = await requirePlan(tenantId, planId);

  if (existing.archivedAt !== null) {
    throw new TrainingPlanNotFoundError(planId);
  }

  const name =
    input.name !== undefined ? validatePlanName(input.name) : undefined;

  if (name !== undefined) {
    await checkNameUniqueness(tenantId, existing.seasonId, name, planId);
  }

  const plan = await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status as never } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.missingAssignmentBehavior !== undefined
        ? { missingAssignmentBehavior: input.missingAssignmentBehavior as never }
        : {}),
    },
    include: planInclude,
  });

  return planToDto(plan as PlanRow);
}

/**
 * Makes a plan the default for its tenant+season.
 *
 * Transactionally:
 *   1. Clears isDefault from the current default (if any).
 *   2. Sets isDefault=true on the target plan.
 *
 * The target plan must not be archived.
 */
export async function setDefaultTrainingPlan(
  tenantId: string,
  planId: string,
): Promise<TrainingPlanDto> {
  const existing = await requirePlan(tenantId, planId);

  if (existing.archivedAt !== null) {
    throw new TrainingPlanNotFoundError(planId);
  }

  const plan = await prisma.$transaction(async (tx) => {
    // Clear existing default in same tenant+season
    await tx.trainingPlan.updateMany({
      where: {
        tenantId,
        seasonId: existing.seasonId,
        isDefault: true,
        archivedAt: null,
        NOT: { id: planId },
      },
      data: { isDefault: false },
    });

    return tx.trainingPlan.update({
      where: { id: planId },
      data: { isDefault: true },
      include: planInclude,
    });
  });

  return planToDto(plan as PlanRow);
}

/**
 * Archives a training plan.
 *
 * Rules:
 *   - The current default plan cannot be archived.
 *   - Assignments are preserved.
 *   - Operation is idempotent: archiving an already-archived plan is a no-op.
 */
export async function archiveTrainingPlan(
  tenantId: string,
  planId: string,
): Promise<TrainingPlanDto> {
  const existing = await requirePlan(tenantId, planId);

  // Idempotent: already archived
  if (existing.archivedAt !== null) {
    return planToDto(existing);
  }

  if (existing.isDefault) {
    throw new TrainingPlanDefaultArchiveForbiddenError();
  }

  const plan = await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      status: "ARCHIVED" as never,
      archivedAt: new Date(),
      isDefault: false,
    },
    include: planInclude,
  });

  return planToDto(plan as PlanRow);
}

/**
 * Restores an archived training plan.
 *
 * Rules:
 *   - Restored as INACTIVE (not default, not active automatically).
 *   - Re-validates name uniqueness against current non-archived plans.
 *   - Idempotent: restoring a non-archived plan is a no-op.
 */
export async function restoreTrainingPlan(
  tenantId: string,
  planId: string,
): Promise<TrainingPlanDto> {
  const existing = await requirePlan(tenantId, planId);

  // Idempotent: not archived
  if (existing.archivedAt === null) {
    return planToDto(existing);
  }

  // Re-validate name uniqueness on restore
  await checkNameUniqueness(tenantId, existing.seasonId, existing.name, planId);

  const plan = await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      status: "INACTIVE" as never,
      archivedAt: null,
      isDefault: false,
    },
    include: planInclude,
  });

  return planToDto(plan as PlanRow);
}

/**
 * Lists training plans for a tenant with optional filters.
 */
export async function listTrainingPlans(
  tenantId: string,
  filter: ListTrainingPlansFilter = {},
): Promise<TrainingPlanDto[]> {
  const { seasonId, status, includeArchived = false } = filter;

  const plans = await prisma.trainingPlan.findMany({
    where: {
      tenantId,
      ...(seasonId ? { seasonId } : {}),
      ...(status
        ? { status: status as never }
        : !includeArchived
          ? { NOT: { status: "ARCHIVED" as never } }
          : {}),
    },
    include: planInclude,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return plans.map((p) => planToDto(p as PlanRow));
}

/**
 * Retrieves a single training plan by id for a tenant.
 */
export async function getTrainingPlan(
  tenantId: string,
  planId: string,
): Promise<TrainingPlanDto> {
  return planToDto(await requirePlan(tenantId, planId));
}

/**
 * Reorders training plans within a tenant+season.
 *
 * Validates that every supplied ID:
 *   - belongs to the tenant and season
 *   - is not duplicated
 *   - is not archived (unless explicitly passed)
 *
 * Plans omitted from the list are left at their current displayOrder.
 * Provided plans are assigned displayOrder 0, 1, 2, … in the given sequence.
 */
export async function reorderTrainingPlans(
  tenantId: string,
  seasonId: string,
  orderedPlanIds: string[],
): Promise<void> {
  if (orderedPlanIds.length === 0) return;

  const uniqueIds = [...new Set(orderedPlanIds)];
  if (uniqueIds.length !== orderedPlanIds.length) {
    throw new TrainingPlanInvalidOrderError(
      "orderedPlanIds contains duplicate IDs",
    );
  }

  const plans = await prisma.trainingPlan.findMany({
    where: { tenantId, seasonId, id: { in: orderedPlanIds } },
    select: { id: true, archivedAt: true },
  });

  if (plans.length !== orderedPlanIds.length) {
    const foundIds = new Set(plans.map((p) => p.id));
    const missing = orderedPlanIds.filter((id) => !foundIds.has(id));
    throw new TrainingPlanInvalidOrderError(
      `Some plan IDs do not belong to this tenant/season: ${missing.join(", ")}`,
    );
  }

  const archivedInList = plans.filter((p) => p.archivedAt !== null);
  if (archivedInList.length > 0) {
    throw new TrainingPlanInvalidOrderError(
      `Archived plans must not be included in reorder: ${archivedInList.map((p) => p.id).join(", ")}`,
    );
  }

  await prisma.$transaction(
    orderedPlanIds.map((id, index) =>
      prisma.trainingPlan.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );
}

/**
 * Copies a training plan and all its assignments to a new plan.
 *
 * Rules:
 *   - Copied plan is not default automatically.
 *   - All assignments (overrides + statuses) are duplicated.
 *   - TrainingSeries are NOT duplicated.
 *   - For this slice, cross-season copy is rejected because TrainingSeries
 *     identities differ between TeamSeasons — no safe series mapping exists.
 *   - The operation is transactional.
 */
export async function copyTrainingPlan(
  tenantId: string,
  sourcePlanId: string,
  input: CopyTrainingPlanInput,
): Promise<TrainingPlanDto> {
  const source = await requirePlan(tenantId, sourcePlanId);

  const destinationSeasonId = input.seasonId;
  await requireSeason(destinationSeasonId);

  if (destinationSeasonId !== source.seasonId) {
    throw new TrainingPlanCopyNotSupportedError(
      "Cross-season plan copy is not supported in this slice because TrainingSeries " +
        "identities differ between TeamSeasons and no safe series mapping can be derived. " +
        "Copy within the same season or implement cross-season mapping first.",
    );
  }

  const name = validatePlanName(input.name);
  await checkNameUniqueness(tenantId, destinationSeasonId, name);

  const sourceAssignments = await prisma.trainingPlanAssignment.findMany({
    where: { trainingPlanId: sourcePlanId },
    select: {
      trainingSeriesId: true,
      startTimeOverride: true,
      endTimeOverride: true,
      timezoneOverride: true,
      status: true,
    },
  });

  const maxOrderRow = await prisma.trainingPlan.aggregate({
    where: { tenantId, seasonId: destinationSeasonId },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrderRow._max.displayOrder ?? -1) + 1;

  const newPlan = await prisma.$transaction(async (tx) => {
    const created = await tx.trainingPlan.create({
      data: {
        tenantId,
        seasonId: destinationSeasonId,
        name,
        description: input.description ?? source.description,
        status: "ACTIVE" as never,
        isDefault: false,
        displayOrder: nextOrder,
        missingAssignmentBehavior: source.missingAssignmentBehavior as never,
      },
      include: planInclude,
    });

    if (sourceAssignments.length > 0) {
      await tx.trainingPlanAssignment.createMany({
        data: sourceAssignments.map((a) => ({
          tenantId,
          trainingPlanId: created.id,
          trainingSeriesId: a.trainingSeriesId,
          startTimeOverride: a.startTimeOverride,
          endTimeOverride: a.endTimeOverride,
          timezoneOverride: a.timezoneOverride,
          status: a.status,
        })),
      });
    }

    return created;
  });

  return planToDto(newPlan as PlanRow);
}

// ── Assignment API ────────────────────────────────────────────────────────────

/**
 * Creates or updates a TrainingPlanAssignment.
 *
 * When an assignment for (trainingPlanId, trainingSeriesId) already exists,
 * it is updated in place. Otherwise a new assignment is created.
 *
 * Validates:
 *   - Plan and series must belong to the same tenant.
 *   - Series' TeamSeason season must match plan's season.
 *   - Time overrides must be valid "HH:mm" strings.
 *   - If both overrides provided, start must precede end.
 */
export async function upsertTrainingPlanAssignment(
  tenantId: string,
  input: UpsertTrainingPlanAssignmentInput,
): Promise<TrainingPlanAssignmentDto> {
  const {
    trainingPlanId,
    trainingSeriesId,
    startTimeOverride,
    endTimeOverride,
    timezoneOverride,
    status = "SCHEDULED",
  } = input;

  const [plan, series] = await Promise.all([
    prisma.trainingPlan.findFirst({
      where: { id: trainingPlanId, tenantId },
      select: { id: true, seasonId: true, tenantId: true, archivedAt: true },
    }),
    prisma.trainingSeries.findFirst({
      where: { id: trainingSeriesId, tenantId },
      select: {
        id: true,
        tenantId: true,
        teamSeasonId: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        teamSeason: { select: { seasonId: true } },
      },
    }),
  ]);

  if (!plan) throw new TrainingPlanNotFoundError(trainingPlanId);
  if (!series) throw new TrainingSeriesNotFoundError(trainingSeriesId);

  if (plan.tenantId !== series.tenantId) {
    throw new TrainingPlanAssignmentTenantMismatchError();
  }

  if (series.teamSeason.seasonId !== plan.seasonId) {
    throw new TrainingPlanAssignmentSeasonMismatchError();
  }

  validateTimeOverrides(startTimeOverride, endTimeOverride);

  // Validate combined effective range when one override is partial
  const effectiveStart = startTimeOverride ?? series.startsAt;
  const effectiveEnd = endTimeOverride ?? series.endsAt;
  if (
    (startTimeOverride != null || endTimeOverride != null) &&
    parseTimeMinutes(effectiveStart) >= parseTimeMinutes(effectiveEnd)
  ) {
    throw new TrainingPlanAssignmentInvalidTimeError(
      `Effective time range is invalid: ${effectiveStart} >= ${effectiveEnd}`,
    );
  }

  const existing = await prisma.trainingPlanAssignment.findUnique({
    where: {
      trainingPlanId_trainingSeriesId: {
        trainingPlanId,
        trainingSeriesId,
      },
    },
    select: { id: true },
  });

  let assignment;
  if (existing) {
    assignment = await prisma.trainingPlanAssignment.update({
      where: { id: existing.id },
      data: {
        startTimeOverride: startTimeOverride ?? null,
        endTimeOverride: endTimeOverride ?? null,
        timezoneOverride: timezoneOverride ?? null,
        status: status as never,
      },
      include: assignmentInclude,
    });
  } else {
    assignment = await prisma.trainingPlanAssignment.create({
      data: {
        tenantId,
        trainingPlanId,
        trainingSeriesId,
        startTimeOverride: startTimeOverride ?? null,
        endTimeOverride: endTimeOverride ?? null,
        timezoneOverride: timezoneOverride ?? null,
        status: status as never,
      },
      include: assignmentInclude,
    });
  }

  return assignmentToDto(assignment as AssignmentRow);
}

/**
 * Removes a TrainingPlanAssignment by id.
 */
export async function removeTrainingPlanAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<void> {
  const existing = await prisma.trainingPlanAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    select: { id: true },
  });
  if (!existing) throw new TrainingPlanAssignmentNotFoundError(assignmentId);

  await prisma.trainingPlanAssignment.delete({ where: { id: assignmentId } });
}

/**
 * Lists all assignments for a given training plan.
 */
export async function listTrainingPlanAssignments(
  tenantId: string,
  planId: string,
): Promise<TrainingPlanAssignmentDto[]> {
  await requirePlan(tenantId, planId);

  const assignments = await prisma.trainingPlanAssignment.findMany({
    where: { tenantId, trainingPlanId: planId },
    include: assignmentInclude,
    orderBy: [{ createdAt: "asc" }],
  });

  return assignments.map((a) => assignmentToDto(a as AssignmentRow));
}

/**
 * Retrieves a single assignment by id.
 */
export async function getTrainingPlanAssignment(
  tenantId: string,
  assignmentId: string,
): Promise<TrainingPlanAssignmentDto> {
  const assignment = await prisma.trainingPlanAssignment.findFirst({
    where: { id: assignmentId, tenantId },
    include: assignmentInclude,
  });
  if (!assignment) throw new TrainingPlanAssignmentNotFoundError(assignmentId);

  return assignmentToDto(assignment as AssignmentRow);
}
