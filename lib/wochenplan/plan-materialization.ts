/**
 * lib/wochenplan/plan-materialization.ts
 *
 * WOCHENPLAN-2.0-01F — materializes tenant-level WochenplanPlan definitions into
 * week-scoped WeekplannerPlan rows linked by stable wochenplanPlanId.
 *
 * Identity is always wochenplanPlanId — display names are presentational only.
 * Default (isDefault) plans never materialize; Standardplan remains weekplannerPlanId=null.
 */

import { prisma } from "@/lib/db/prisma";
import { createWeekplannerPlan } from "@/lib/weekplanner/plan-service";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import { WeekplannerPlanValidationError } from "@/lib/weekplanner/plan-errors";
import { findLinkedWeekplannerPlan } from "./public-plan-resolution";
import {
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
} from "./plan-errors";

export type MaterializeLinkedWeekplannerPlanOptions = {
  createdByUserId?: string | null;
  /** Sync WeekplannerPlan.name from the tenant definition when reusing an existing row. Default: true. */
  syncDisplayName?: boolean;
};

export type MaterializeLinkedWeekplannerPlanResult = {
  weekplannerPlan: WeekplannerPlanDto;
  created: boolean;
};

async function requireMaterializableWochenplanPlan(
  tenantId: string,
  wochenplanPlanId: string,
): Promise<{ id: string; name: string; isDefault: boolean; archivedAt: Date | null }> {
  const definition = await prisma.wochenplanPlan.findFirst({
    where: { id: wochenplanPlanId, tenantId },
    select: { id: true, name: true, isDefault: true, archivedAt: true },
  });

  if (!definition) {
    throw new WochenplanPlanNotFoundError(wochenplanPlanId);
  }
  if (definition.archivedAt) {
    throw new WochenplanPlanArchivedError(wochenplanPlanId);
  }
  if (definition.isDefault) {
    throw new WochenplanPlanValidationError(
      "The default WochenplanPlan does not require a week-scoped WeekplannerPlan — use Standardplan",
    );
  }

  return definition;
}

async function loadLinkedWeekplannerPlanDto(
  tenantId: string,
  weekplannerPlanId: string,
): Promise<WeekplannerPlanDto> {
  const row = await prisma.weekplannerPlan.findFirst({
    where: { id: weekplannerPlanId, tenantId, archivedAt: null },
  });
  if (!row) {
    throw new WochenplanPlanValidationError(
      `Linked WeekplannerPlan "${weekplannerPlanId}" is missing or archived`,
    );
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    weekId: row.weekId,
    name: row.name,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: null,
    isActive: row.isActive,
    wochenplanPlanId: row.wochenplanPlanId,
  };
}

async function syncLinkedDisplayName(
  tenantId: string,
  weekplannerPlanId: string,
  name: string,
): Promise<WeekplannerPlanDto> {
  const row = await prisma.weekplannerPlan.update({
    where: { id: weekplannerPlanId },
    data: { name },
  });

  return {
    id: row.id,
    tenantId: row.tenantId,
    weekId: row.weekId,
    name: row.name,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: null,
    isActive: row.isActive,
    wochenplanPlanId: row.wochenplanPlanId,
  };
}

/**
 * Resolves an existing linked WeekplannerPlan or creates one idempotently for
 * (tenantId, weekId, wochenplanPlanId). Never matches by display name.
 */
export async function materializeLinkedWeekplannerPlan(
  tenantId: string,
  weekId: string,
  wochenplanPlanId: string,
  options: MaterializeLinkedWeekplannerPlanOptions = {},
): Promise<MaterializeLinkedWeekplannerPlanResult> {
  const syncDisplayName = options.syncDisplayName ?? true;
  const definition = await requireMaterializableWochenplanPlan(tenantId, wochenplanPlanId);

  const existing = await findLinkedWeekplannerPlan(tenantId, weekId, wochenplanPlanId);
  if (existing) {
    let weekplannerPlan = await loadLinkedWeekplannerPlanDto(tenantId, existing.id);
    if (syncDisplayName && weekplannerPlan.name !== definition.name) {
      weekplannerPlan = await syncLinkedDisplayName(tenantId, existing.id, definition.name);
    }
    return { weekplannerPlan, created: false };
  }

  try {
    const weekplannerPlan = await createWeekplannerPlan(tenantId, {
      weekId,
      name: definition.name,
      createdByUserId: options.createdByUserId ?? null,
      wochenplanPlanId: definition.id,
    });
    return { weekplannerPlan, created: true };
  } catch (err) {
    if (
      err instanceof WeekplannerPlanValidationError &&
      err.message.includes("already exists for week")
    ) {
      const raced = await findLinkedWeekplannerPlan(tenantId, weekId, wochenplanPlanId);
      if (!raced) throw err;
      let weekplannerPlan = await loadLinkedWeekplannerPlanDto(tenantId, raced.id);
      if (syncDisplayName && weekplannerPlan.name !== definition.name) {
        weekplannerPlan = await syncLinkedDisplayName(tenantId, raced.id, definition.name);
      }
      return { weekplannerPlan, created: false };
    }
    throw err;
  }
}

/**
 * Keeps materialized WeekplannerPlan display names aligned after a tenant-level rename.
 * Identity remains wochenplanPlanId.
 */
export async function syncMaterializedWeekplannerPlanNames(
  tenantId: string,
  wochenplanPlanId: string,
  name: string,
): Promise<number> {
  const result = await prisma.weekplannerPlan.updateMany({
    where: { tenantId, wochenplanPlanId, archivedAt: null },
    data: { name },
  });
  return result.count;
}
