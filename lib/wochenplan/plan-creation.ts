/**
 * lib/wochenplan/plan-creation.ts
 *
 * WOCHENPLAN-2.0-01H-C — tenant-level plan creation with optional week
 * materialization and copy-from-source semantics.
 */

import { prisma } from "@/lib/db/prisma";
import { buildEmptyBaselineDescription } from "./plan-baseline";
import { createWochenplanPlan } from "./plan-service";
import { materializeLinkedWeekplannerPlan } from "./plan-materialization";
import type { WochenplanPlanDto } from "./plan-types";
import {
  WochenplanPlanArchivedError,
  WochenplanPlanNotFoundError,
  WochenplanPlanValidationError,
} from "./plan-errors";
import { copyWeekplannerOperationalState } from "@/lib/weekplanner/plan-copy";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import { WeekplannerPlanValidationError } from "@/lib/weekplanner/plan-errors";

const WEEK_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type WochenplanPlanCreationMode = "empty" | "copy";

export type CreateWochenplanPlanWithWeekInput = {
  name: string;
  description?: string | null;
  weekId: string;
  mode: WochenplanPlanCreationMode;
  /** Required when mode is "copy". Tenant-level WochenplanPlan id. */
  sourceWochenplanPlanId?: string | null;
  createdByUserId?: string | null;
};

export type CreateWochenplanPlanWithWeekResult = {
  plan: WochenplanPlanDto;
  weekplannerPlan: WeekplannerPlanDto;
};

function validateWeekId(weekId: string): string {
  const trimmed = weekId.trim();
  if (!WEEK_ID_PATTERN.test(trimmed)) {
    throw new WeekplannerPlanValidationError(
      `weekId must be a "YYYY-MM-DD" Monday date, got: "${weekId}"`,
    );
  }
  return trimmed;
}

async function validateCopySource(tenantId: string, sourceWochenplanPlanId: string): Promise<void> {
  const source = await prisma.wochenplanPlan.findFirst({
    where: { id: sourceWochenplanPlanId, tenantId },
    select: { id: true, archivedAt: true },
  });
  if (!source) {
    throw new WochenplanPlanNotFoundError(sourceWochenplanPlanId);
  }
  if (source.archivedAt) {
    throw new WochenplanPlanArchivedError(sourceWochenplanPlanId);
  }
}

async function rollbackCreatedPlan(planId: string, weekplannerPlanId: string | null): Promise<void> {
  try {
    if (weekplannerPlanId) {
      await prisma.weekplannerPlan.delete({ where: { id: weekplannerPlanId } }).catch(() => {});
    }
    await prisma.wochenplanPlan.delete({ where: { id: planId } }).catch(() => {});
  } catch {
    // Best-effort rollback only.
  }
}

/**
 * Creates a tenant-level alternative WochenplanPlan, materializes its linked
 * WeekplannerPlan for the requested week, and optionally copies sparse weekly
 * operational overrides from a source plan.
 *
 * Empty start: materialized plan has zero override rows and an empty baseline
 * marker so the week canvas does not inherit canonical activities.
 * Copy: copies source WeekplannerPlan override rows transactionally when present.
 */
export async function createWochenplanPlanWithWeek(
  tenantId: string,
  input: CreateWochenplanPlanWithWeekInput,
): Promise<CreateWochenplanPlanWithWeekResult> {
  const weekId = validateWeekId(input.weekId);
  const mode = input.mode;

  if (mode === "copy") {
    const sourceId = input.sourceWochenplanPlanId?.trim();
    if (!sourceId) {
      throw new WochenplanPlanValidationError("sourceWochenplanPlanId is required when mode is copy");
    }
    await validateCopySource(tenantId, sourceId);
  }

  let createdPlanId: string | null = null;
  let createdWeekplannerPlanId: string | null = null;

  try {
    let plan = await createWochenplanPlan(tenantId, {
      name: input.name,
      description:
        mode === "empty"
          ? buildEmptyBaselineDescription(input.description)
          : input.description,
    });
    createdPlanId = plan.id;

    const materialized = await materializeLinkedWeekplannerPlan(tenantId, weekId, plan.id, {
      createdByUserId: input.createdByUserId ?? null,
    });
    createdWeekplannerPlanId = materialized.weekplannerPlan.id;

    if (mode === "copy" && input.sourceWochenplanPlanId) {
      const sourceId = input.sourceWochenplanPlanId.trim();
      await copyWeekplannerOperationalState(
        tenantId,
        weekId,
        sourceId,
        materialized.weekplannerPlan.id,
      );

      const sourceDefinition = await prisma.wochenplanPlan.findFirst({
        where: { id: sourceId, tenantId },
        select: { description: true },
      });
      if (sourceDefinition?.description) {
        await prisma.wochenplanPlan.update({
          where: { id: plan.id },
          data: { description: sourceDefinition.description },
        });
        plan = { ...plan, description: sourceDefinition.description };
      }
    }

    return {
      plan,
      weekplannerPlan: materialized.weekplannerPlan,
    };
  } catch (err) {
    if (createdPlanId) {
      await rollbackCreatedPlan(createdPlanId, createdWeekplannerPlanId);
    }
    throw err;
  }
}
