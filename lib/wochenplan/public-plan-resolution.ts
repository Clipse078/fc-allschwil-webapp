/**
 * lib/wochenplan/public-plan-resolution.ts
 *
 * WOCHENPLAN-2.0-01C/01E/01H-D — bridges tenant-level WochenplanPlan (canonical
 * active plan) to week-scoped WeekplannerPlan effective state for a requested week.
 *
 * Canonical identity is ID-based via WeekplannerPlan.wochenplanPlanId.
 * Human-readable plan names are display metadata only and MUST NOT be used
 * for resolution.
 *
 * Resolution semantics:
 *   DEFAULT WochenplanPlan (isDefault=true)
 *     → Standardplan (weekplannerPlanId=null): canonical base week state.
 *   ALTERNATIVE WochenplanPlan
 *     → linked WeekplannerPlan for (tenantId, weekId, wochenplanPlanId).
 *     → if no concrete week instance exists, fall back to Standardplan.
 *       The active WochenplanPlan metadata is still returned for the public
 *       contract; effective activities use base state until materialized.
 */

import { prisma } from "@/lib/db/prisma";
import type { WochenplanPlanDto } from "./plan-types";

export type ResolvedPublicWeekplannerPlan = {
  /** WeekplannerPlan id when a linked alternative exists; null for Standardplan. */
  weekplannerPlanId: string | null;
  /** Tenant-level active/public plan (never an inactive or archived plan). */
  activeWochenplanPlan: WochenplanPlanDto | null;
  /**
   * True when the active alternative has no linked concrete week plan for
   * the requested week — effective state falls back to Standardplan.
   */
  usedStandardplanFallback: boolean;
};

/**
 * Finds the non-archived WeekplannerPlan linked to a tenant-level definition
 * for one week. Returns null when no concrete instance exists.
 */
export async function findLinkedWeekplannerPlan(
  tenantId: string,
  weekId: string,
  wochenplanPlanId: string,
): Promise<{ id: string } | null> {
  return prisma.weekplannerPlan.findFirst({
    where: {
      tenantId,
      weekId,
      wochenplanPlanId,
      archivedAt: null,
    },
    select: { id: true },
  });
}

/**
 * Resolves which WeekplannerPlan (if any) should drive effective planning
 * state for the public current-week feed.
 */
export async function resolvePublicWeekplannerPlan(
  tenantId: string,
  weekId: string,
  activeWochenplanPlan: WochenplanPlanDto | null,
): Promise<ResolvedPublicWeekplannerPlan> {
  if (!activeWochenplanPlan || activeWochenplanPlan.archivedAt) {
    return {
      weekplannerPlanId: null,
      activeWochenplanPlan: null,
      usedStandardplanFallback: false,
    };
  }

  if (activeWochenplanPlan.isDefault) {
    return {
      weekplannerPlanId: null,
      activeWochenplanPlan,
      usedStandardplanFallback: false,
    };
  }

  const linkedPlan = await findLinkedWeekplannerPlan(
    tenantId,
    weekId,
    activeWochenplanPlan.id,
  );

  return {
    weekplannerPlanId: linkedPlan?.id ?? null,
    activeWochenplanPlan,
    usedStandardplanFallback: linkedPlan === null,
  };
}
