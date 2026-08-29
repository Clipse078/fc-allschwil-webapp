/**
 * lib/wochenplan/plan-service.ts
 *
 * WOCHENPLAN-2.0-01B — domain service for tenant-level WochenplanPlan and
 * WochenplanPlanAllocation.
 *
 * Architecture:
 *   Tenant → WochenplanPlan → WochenplanPlanAllocation (sparse overrides)
 *
 * The default plan's allocations live on canonical Event fields. Alternative
 * plans inherit Event allocations and apply sparse overrides per event.
 *
 * Security invariants:
 *   - tenantId always comes from trusted session context.
 *   - All DB queries are scoped by tenantId.
 */

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { syncMaterializedWeekplannerPlanNames } from "./plan-materialization";
import type {
  WochenplanPlanDto,
  WochenplanPlanAllocationDto,
  CreateWochenplanPlanInput,
  UpsertWochenplanPlanAllocationInput,
} from "./plan-types";
import {
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
  WochenplanPlanNameConflictError,
  WochenplanPlanArchivedError,
  WochenplanPlanActivationConflictError,
  WochenplanPlanAllocationEventNotFoundError,
  WochenplanPlanDeleteActiveForbiddenError,
  WochenplanPlanDeleteLastPlanForbiddenError,
} from "./plan-errors";

const MAX_NAME_LENGTH = 100;

type PlanRow = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type AllocationRow = {
  id: string;
  tenantId: string;
  wochenplanPlanId: string;
  eventId: string;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function planToDto(row: PlanRow): WochenplanPlanDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    isActive: row.isActive,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function allocationToDto(row: AllocationRow): WochenplanPlanAllocationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    wochenplanPlanId: row.wochenplanPlanId,
    eventId: row.eventId,
    pitchCode: row.pitchCode,
    homeDressingRoomCode: row.homeDressingRoomCode,
    awayDressingRoomCode: row.awayDressingRoomCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validatePlanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new WochenplanPlanValidationError("Plan name must not be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new WochenplanPlanValidationError(
      `Plan name must not exceed ${MAX_NAME_LENGTH} characters`,
    );
  }
  return trimmed;
}

async function requirePlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await prisma.wochenplanPlan.findFirst({
    where: { id: planId, tenantId },
  });
  if (!plan) throw new WochenplanPlanNotFoundError(planId);
  return plan;
}

async function requireActivePlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await requirePlan(tenantId, planId);
  if (plan.archivedAt) throw new WochenplanPlanArchivedError(planId);
  return plan;
}

async function requireNameAvailable(
  tenantId: string,
  name: string,
  excludePlanId?: string,
): Promise<void> {
  const conflict = await prisma.wochenplanPlan.findFirst({
    where: {
      tenantId,
      archivedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
    },
    select: { id: true },
  });
  if (conflict) throw new WochenplanPlanNameConflictError(name);
}

export async function listWochenplanPlans(tenantId: string): Promise<WochenplanPlanDto[]> {
  const plans = await prisma.wochenplanPlan.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return plans.map((p) => planToDto(p));
}

export async function getWochenplanPlan(tenantId: string, planId: string): Promise<WochenplanPlanDto> {
  return planToDto(await requirePlan(tenantId, planId));
}

export async function getActiveWochenplanPlan(tenantId: string): Promise<WochenplanPlanDto | null> {
  const plan = await prisma.wochenplanPlan.findFirst({
    where: { tenantId, isActive: true, archivedAt: null },
  });
  return plan ? planToDto(plan) : null;
}

export async function getDefaultWochenplanPlan(tenantId: string): Promise<WochenplanPlanDto | null> {
  const plan = await prisma.wochenplanPlan.findFirst({
    where: { tenantId, isDefault: true, archivedAt: null },
  });
  return plan ? planToDto(plan) : null;
}

export async function createWochenplanPlan(
  tenantId: string,
  input: CreateWochenplanPlanInput,
): Promise<WochenplanPlanDto> {
  const name = validatePlanName(input.name);
  await requireNameAvailable(tenantId, name);

  const maxOrder = await prisma.wochenplanPlan.aggregate({
    where: { tenantId, archivedAt: null },
    _max: { displayOrder: true },
  });

  try {
    const plan = await prisma.wochenplanPlan.create({
      data: {
        tenantId,
        name,
        description: input.description?.trim() || null,
        isDefault: false,
        isActive: false,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
    return planToDto(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("Unique")) {
      throw new WochenplanPlanNameConflictError(name);
    }
    throw err;
  }
}

export async function renameWochenplanPlan(
  tenantId: string,
  planId: string,
  name: string,
): Promise<WochenplanPlanDto> {
  const existing = await requireActivePlan(tenantId, planId);
  const validated = validatePlanName(name);
  await requireNameAvailable(tenantId, validated, planId);

  try {
    const plan = await prisma.wochenplanPlan.update({
      where: { id: existing.id },
      data: { name: validated },
    });
    await syncMaterializedWeekplannerPlanNames(tenantId, planId, validated);
    return planToDto(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("Unique")) {
      throw new WochenplanPlanNameConflictError(validated);
    }
    throw err;
  }
}

export async function activateWochenplanPlan(
  tenantId: string,
  planId: string,
): Promise<WochenplanPlanDto> {
  await requireActivePlan(tenantId, planId);

  try {
    const plan = await prisma.$transaction(async (tx) => {
      await tx.wochenplanPlan.updateMany({
        where: {
          tenantId,
          isActive: true,
          archivedAt: null,
          NOT: { id: planId },
        },
        data: { isActive: false },
      });

      const activated = await tx.wochenplanPlan.updateMany({
        where: { id: planId, tenantId, archivedAt: null },
        data: { isActive: true },
      });

      if (activated.count !== 1) {
        throw new WochenplanPlanArchivedError(planId);
      }

      // Keep WeekplannerPlan.isActive synchronized as an implementation detail
      // for legacy consumers — canonical product state is WochenplanPlan.isActive.
      await tx.weekplannerPlan.updateMany({
        where: { tenantId, isActive: true, archivedAt: null },
        data: { isActive: false },
      });

      const activatedDefinition = await tx.wochenplanPlan.findFirst({
        where: { id: planId, tenantId },
        select: { isDefault: true },
      });

      if (activatedDefinition && !activatedDefinition.isDefault) {
        await tx.weekplannerPlan.updateMany({
          where: { tenantId, wochenplanPlanId: planId, archivedAt: null },
          data: { isActive: true },
        });
      }

      return tx.wochenplanPlan.findFirst({ where: { id: planId, tenantId } });
    });

    if (!plan) throw new WochenplanPlanNotFoundError(planId);
    return planToDto(plan);
  } catch (err) {
    if (
      err instanceof WochenplanPlanArchivedError ||
      err instanceof WochenplanPlanNotFoundError
    ) {
      throw err;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new WochenplanPlanActivationConflictError(planId);
    }
    throw err;
  }
}

export async function upsertWochenplanPlanAllocation(
  tenantId: string,
  input: UpsertWochenplanPlanAllocationInput,
): Promise<WochenplanPlanAllocationDto> {
  const plan = await requireActivePlan(tenantId, input.wochenplanPlanId);
  if (plan.isDefault) {
    throw new WochenplanPlanValidationError(
      "Default plan allocations are stored on Event fields — do not use plan allocation overrides",
    );
  }

  const event = await prisma.event.findFirst({
    where: { id: input.eventId, tenantId },
    select: { id: true },
  });
  if (!event) throw new WochenplanPlanAllocationEventNotFoundError(input.eventId);

  const row = await prisma.wochenplanPlanAllocation.upsert({
    where: {
      wochenplanPlanId_eventId: {
        wochenplanPlanId: input.wochenplanPlanId,
        eventId: input.eventId,
      },
    },
    create: {
      tenantId,
      wochenplanPlanId: input.wochenplanPlanId,
      eventId: input.eventId,
      pitchCode: input.pitchCode,
      homeDressingRoomCode: input.homeDressingRoomCode,
      awayDressingRoomCode: input.awayDressingRoomCode,
    },
    update: {
      pitchCode: input.pitchCode,
      homeDressingRoomCode: input.homeDressingRoomCode,
      awayDressingRoomCode: input.awayDressingRoomCode,
    },
  });

  return allocationToDto(row);
}

export async function listWochenplanPlanAllocations(
  tenantId: string,
  planId: string,
): Promise<WochenplanPlanAllocationDto[]> {
  await requirePlan(tenantId, planId);
  const rows = await prisma.wochenplanPlanAllocation.findMany({
    where: { tenantId, wochenplanPlanId: planId },
  });
  return rows.map((r) => allocationToDto(r));
}

export function isDefaultPlan(plan: Pick<WochenplanPlanDto, "isDefault">): boolean {
  return plan.isDefault;
}

/**
 * Permanently deletes a draft WochenplanPlan and all linked week-scoped
 * materialized state (WeekplannerPlan rows, allocations, time overrides).
 * Canonical TrainingSession/Event/Match data is never touched.
 */
export async function deleteWochenplanPlan(
  tenantId: string,
  planId: string,
): Promise<{ id: string; name: string }> {
  const plan = await requirePlan(tenantId, planId);

  if (plan.isActive) {
    throw new WochenplanPlanDeleteActiveForbiddenError(planId);
  }

  const remainingPlans = await prisma.wochenplanPlan.count({
    where: { tenantId, archivedAt: null },
  });
  if (remainingPlans <= 1) {
    throw new WochenplanPlanDeleteLastPlanForbiddenError(planId);
  }

  await prisma.$transaction(async (tx) => {
    if (plan.isDefault) {
      const successor = await tx.wochenplanPlan.findFirst({
        where: { tenantId, archivedAt: null, NOT: { id: planId } },
        orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
      });
      if (!successor) {
        throw new WochenplanPlanDeleteLastPlanForbiddenError(planId);
      }
      // Clear every default flag (including the plan being deleted) before
      // promoting the successor — otherwise the deleted row still has
      // isDefault=true and violates WochenplanPlan_tenantId_isDefault_unique.
      await tx.wochenplanPlan.updateMany({
        where: { tenantId, isDefault: true, archivedAt: null },
        data: { isDefault: false },
      });
      await tx.wochenplanPlan.update({
        where: { id: successor.id },
        data: { isDefault: true },
      });
    }

    const linkedWeekplannerPlans = await tx.weekplannerPlan.findMany({
      where: { tenantId, wochenplanPlanId: planId },
      select: { id: true },
    });

    for (const linked of linkedWeekplannerPlans) {
      await tx.weekplannerPlan.delete({ where: { id: linked.id } });
    }

    await tx.wochenplanPlan.delete({ where: { id: plan.id } });
  });

  return { id: plan.id, name: plan.name };
}
