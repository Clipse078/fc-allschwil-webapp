/**
 * Target query helpers — server-only.
 *
 * All queries now accept an ActorContext and apply VisibilityScope filtering,
 * consistent with Meeting and Initiative queries.
 *
 * 404-masking: getTargetById() returns null for records the actor cannot see.
 *
 * TODO: Phase 2 — push RESTRICTED filtering into the DB query using
 *   PostgreSQL JSONB @> for role/user overlap checks (same as Meeting/Initiative).
 */

import { prisma } from "@/lib/db/prisma";
import type { ActorContext } from "@/lib/visibility/actor-context";
import { buildVisibilityWhere, applyVisibilityFilter, canSeeEntity } from "@/lib/visibility/visibility-filter";

const TARGET_VISIBILITY_SELECT = {
  visibilityScope: true,
  createdByUserId: true,
  visibleRoleRefs: true,
  visibleUserRefs: true,
  visibleTeamRefs: true,
  visibleOrgUnitRefs: true,
  visiblePersonRefs: true,
} as const;

export async function getTargets(actor: ActorContext) {
  const rows = await prisma.target.findMany({
    where: buildVisibilityWhere(actor),
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      startsAt: true,
      endsAt: true,
      ...TARGET_VISIBILITY_SELECT,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return applyVisibilityFilter(rows, actor);
}

export async function getTargetById(id: string, actor: ActorContext) {
  const target = await prisma.target.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      moduleKey: true,
      sportCategory: true,
      ageGroupHint: true,
      startsAt: true,
      endsAt: true,
      nudgeJson: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      linkedInitiativeRefs: true,
      linkedMeetingRefs: true,
      createdAt: true,
      updatedAt: true,
      ...TARGET_VISIBILITY_SELECT,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          notes: true,
          sortOrder: true,
          dataPoints: {
            select: {
              id: true,
              value: true,
              note: true,
              measuredAt: true,
            },
            orderBy: { measuredAt: "desc" },
            take: 10,
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!target) return null;
  // 404-mask: return null if actor cannot see this target
  if (!canSeeEntity(target, actor)) return null;
  return target;
}

export type TargetListItem = Awaited<ReturnType<typeof getTargets>>[number];
export type TargetDetail = Awaited<ReturnType<typeof getTargetById>>;
export type TargetMetricWithDataPoints = NonNullable<TargetDetail>["metrics"][number];
