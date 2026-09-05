/**
 * lib/targets/target-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — Target permanent hard-delete service.
 *
 * Design principles:
 *   • Impact preview never mutates.
 *   • TargetMetric (and TargetDataPoint via metric cascade) cascade on Target delete.
 *   • No tenantId on Target — authorization uses the actor's active tenant.
 *   • A single prisma.target.delete() is sufficient; cascades handle children.
 */

import { prisma } from "@/lib/db/prisma";

export type TargetDeletionImpact = {
  /** Metrics — cascade-deleted */
  metrics: number;
  /** Data points across all metrics — cascade-deleted (via metric cascade) */
  dataPoints: number;
};

export type TargetDeletionResult = {
  targetId: string;
  title: string;
  impact: TargetDeletionImpact;
};

/**
 * Returns the deletion impact for a Target.
 * Returns null when the target does not exist.
 * Never mutates.
 */
export async function getTargetDeletionImpact(
  targetId: string,
  tenantId: string,
): Promise<TargetDeletionImpact | null> {
  const target = await prisma.target.findFirst({
    where: { id: targetId, tenantId },
    select: {
      _count: { select: { metrics: true } },
    },
  });

  if (!target) return null;

  // Count data points across all metrics for this target
  const dataPointCount = await prisma.targetDataPoint.count({
    where: { metric: { targetId } },
  });

  return {
    metrics: target._count.metrics,
    dataPoints: dataPointCount,
  };
}

/**
 * Permanently deletes a Target and all cascade-linked sub-entities.
 *
 * Cascade order (automatic via onDelete: Cascade):
 *   TargetMetric → TargetDataPoint
 *
 * Returns null when the target does not exist (idempotent-safe).
 */
export async function deleteTargetPermanently(
  targetId: string,
  tenantId: string,
): Promise<TargetDeletionResult | null> {
  const target = await prisma.target.findFirst({
    where: { id: targetId, tenantId },
    select: {
      title: true,
      _count: { select: { metrics: true } },
    },
  });

  if (!target) return null;

  const dataPointCount = await prisma.targetDataPoint.count({
    where: { metric: { targetId } },
  });

  const impact: TargetDeletionImpact = {
    metrics: target._count.metrics,
    dataPoints: dataPointCount,
  };

  await prisma.target.delete({ where: { id: targetId, tenantId } });

  return { targetId, title: target.title, impact };
}
