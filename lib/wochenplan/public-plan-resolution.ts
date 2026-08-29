/**
 * lib/wochenplan/public-plan-resolution.ts
 *
 * WOCHENPLAN-2.0-01C — bridges tenant-level WochenplanPlan (public/active)
 * to week-scoped WeekplannerPlan effective state for the current week.
 *
 * The active WochenplanPlan name is public metadata. When a WeekplannerPlan
 * exists for the same tenant+week with a matching name, its effective
 * overrides are applied via getWeekplannerWeek(planId). Otherwise Standardplan
 * (no planId) is used — identical to /dashboard/planner/week semantics.
 */

import { prisma } from "@/lib/db/prisma";
import type { WochenplanPlanDto } from "./plan-types";

export type ResolvedPublicWeekplannerPlan = {
  /** WeekplannerPlan id when a name-matched alternative exists; null for Standardplan. */
  weekplannerPlanId: string | null;
  /** Tenant-level active/public plan (never an inactive plan). */
  activeWochenplanPlan: WochenplanPlanDto | null;
};

/**
 * Resolves which WeekplannerPlan (if any) should drive effective planning
 * state for the public current-week feed.
 */
export async function resolvePublicWeekplannerPlan(
  tenantId: string,
  weekId: string,
  activeWochenplanPlan: WochenplanPlanDto | null,
): Promise<ResolvedPublicWeekplannerPlan> {
  if (!activeWochenplanPlan) {
    return { weekplannerPlanId: null, activeWochenplanPlan: null };
  }

  const matchingPlan = await prisma.weekplannerPlan.findFirst({
    where: {
      tenantId,
      weekId,
      name: activeWochenplanPlan.name,
      archivedAt: null,
    },
    select: { id: true },
  });

  return {
    weekplannerPlanId: matchingPlan?.id ?? null,
    activeWochenplanPlan,
  };
}
