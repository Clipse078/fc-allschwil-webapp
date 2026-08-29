/**
 * lib/weekplanner/plan-copy.ts
 *
 * WOCHENPLAN-2.0-01H-C — copies effective weekly operational state from a
 * source WochenplanPlan into a target WeekplannerPlan for one week.
 *
 * Copies sparse override rows only (WeekplannerPlanAllocation +
 * WeekplannerPlanActivityOverride). Canonical TrainingSession/Event records
 * are never duplicated or mutated.
 *
 * When the source is Standardplan (default WochenplanPlan) or has no
 * materialized week instance yet, there are no override rows to copy — the
 * target inherits the same canonical effective state through the existing
 * fallback architecture.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { findLinkedWeekplannerPlan } from "@/lib/wochenplan/public-plan-resolution";
import {
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
} from "@/lib/wochenplan/plan-errors";
import { WeekplannerPlanNotFoundError, WeekplannerPlanValidationError } from "./plan-errors";

const WEEK_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateWeekId(weekId: string): string {
  const trimmed = weekId.trim();
  if (!WEEK_ID_PATTERN.test(trimmed)) {
    throw new WeekplannerPlanValidationError(
      `weekId must be a "YYYY-MM-DD" Monday date, got: "${weekId}"`,
    );
  }
  return trimmed;
}

async function requireSourceWochenplanPlan(tenantId: string, wochenplanPlanId: string) {
  const definition = await prisma.wochenplanPlan.findFirst({
    where: { id: wochenplanPlanId, tenantId },
    select: { id: true, isDefault: true, archivedAt: true },
  });
  if (!definition) {
    throw new WochenplanPlanNotFoundError(wochenplanPlanId);
  }
  if (definition.archivedAt) {
    throw new WochenplanPlanArchivedError(wochenplanPlanId);
  }
  return definition;
}

async function requireTargetWeekplannerPlan(
  tenantId: string,
  weekId: string,
  targetWeekplannerPlanId: string,
) {
  const target = await prisma.weekplannerPlan.findFirst({
    where: { id: targetWeekplannerPlanId, tenantId, archivedAt: null },
    select: { id: true, weekId: true },
  });
  if (!target) {
    throw new WeekplannerPlanNotFoundError(targetWeekplannerPlanId);
  }
  if (target.weekId !== weekId) {
    throw new WeekplannerPlanValidationError(
      `Target WeekplannerPlan "${targetWeekplannerPlanId}" does not belong to week ${weekId}`,
    );
  }
  return target;
}

type TxClient = Prisma.TransactionClient;

async function copyOverrideRows(
  tx: TxClient,
  tenantId: string,
  sourceWeekplannerPlanId: string,
  targetWeekplannerPlanId: string,
): Promise<void> {
  await tx.weekplannerPlanAllocation.deleteMany({
    where: { tenantId, weekplannerPlanId: targetWeekplannerPlanId },
  });
  await tx.weekplannerPlanActivityOverride.deleteMany({
    where: { tenantId, weekplannerPlanId: targetWeekplannerPlanId },
  });

  const sourceAllocations = await tx.weekplannerPlanAllocation.findMany({
    where: { tenantId, weekplannerPlanId: sourceWeekplannerPlanId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  if (sourceAllocations.length > 0) {
    await tx.weekplannerPlanAllocation.createMany({
      data: sourceAllocations.map((row) => ({
        tenantId,
        weekplannerPlanId: targetWeekplannerPlanId,
        activityType: row.activityType,
        activityId: row.activityId,
        allocationGroup: row.allocationGroup,
        participantId: row.participantId,
        facilityResourceId: row.facilityResourceId,
        notes: row.notes,
        displayOrder: row.displayOrder,
        occupancyBeforeMinutes: row.occupancyBeforeMinutes,
        occupancyAfterMinutes: row.occupancyAfterMinutes,
      })),
    });
  }

  const sourceTimeOverrides = await tx.weekplannerPlanActivityOverride.findMany({
    where: { tenantId, weekplannerPlanId: sourceWeekplannerPlanId },
    orderBy: [{ createdAt: "asc" }],
  });

  if (sourceTimeOverrides.length > 0) {
    await tx.weekplannerPlanActivityOverride.createMany({
      data: sourceTimeOverrides.map((row) => ({
        tenantId,
        weekplannerPlanId: targetWeekplannerPlanId,
        activityType: row.activityType,
        activityId: row.activityId,
        overrideStartAt: row.overrideStartAt,
        overrideEndAt: row.overrideEndAt,
      })),
    });
  }
}

/**
 * Transactionally copies sparse weekly operational overrides from
 * `sourceWochenplanPlanId` into `targetWeekplannerPlanId` for `weekId`.
 */
export async function copyWeekplannerOperationalState(
  tenantId: string,
  weekId: string,
  sourceWochenplanPlanId: string,
  targetWeekplannerPlanId: string,
): Promise<void> {
  const validatedWeekId = validateWeekId(weekId);
  const sourceDefinition = await requireSourceWochenplanPlan(tenantId, sourceWochenplanPlanId);
  await requireTargetWeekplannerPlan(tenantId, validatedWeekId, targetWeekplannerPlanId);

  if (sourceDefinition.isDefault) {
    return;
  }

  const sourceLinked = await findLinkedWeekplannerPlan(
    tenantId,
    validatedWeekId,
    sourceWochenplanPlanId,
  );
  if (!sourceLinked) {
    return;
  }

  if (sourceLinked.id === targetWeekplannerPlanId) {
    throw new WochenplanPlanValidationError("Source and target week plans must be different");
  }

  await prisma.$transaction(async (tx) => {
    await copyOverrideRows(tx, tenantId, sourceLinked.id, targetWeekplannerPlanId);
  });
}
