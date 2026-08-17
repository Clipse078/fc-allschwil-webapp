/**
 * lib/org/target-group-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — TargetGroup permanent hard-delete service.
 *
 * Design principles:
 *   • TargetGroup is tenant-scoped (tenantId field).
 *   • Registration.targetGroupId → onDelete: SetNull → registrations preserved,
 *     targetGroupId nulled. No cascade child rows are hard-deleted.
 *   • Impact preview counts linked registrations that will be unlinked.
 *   • Authorization uses ORG_DELETE via hasTenantDeletionAuthority(targetGroup.tenantId).
 */

import { prisma } from "@/lib/db/prisma";

export type TargetGroupDeletionImpact = {
  /** Registrations with this group assigned — targetGroupId will be nulled (SetNull) */
  linkedRegistrations: number;
};

export type TargetGroupDeletionResult = {
  targetGroupId: string;
  name: string;
  key: string;
  impact: TargetGroupDeletionImpact;
};

/**
 * Returns the deletion impact for a TargetGroup within the given tenant.
 * Returns null when the target group does not exist or belongs to a different tenant.
 * Never mutates.
 */
export async function getTargetGroupDeletionImpact(
  tenantId: string,
  targetGroupId: string,
): Promise<TargetGroupDeletionImpact | null> {
  const tg = await prisma.targetGroup.findUnique({
    where: { id: targetGroupId },
    select: {
      tenantId: true,
      _count: { select: { registrations: true } },
    },
  });

  if (!tg || (tg.tenantId !== null && tg.tenantId !== tenantId)) return null;

  return {
    linkedRegistrations: tg._count.registrations,
  };
}

/**
 * Permanently deletes a TargetGroup within the given tenant.
 *
 * Registration.targetGroupId → SetNull automatically (no explicit pre-cleanup).
 *
 * Returns null when the target group does not exist in the tenant (idempotent-safe).
 */
export async function deleteTargetGroupPermanently(
  tenantId: string,
  targetGroupId: string,
): Promise<TargetGroupDeletionResult | null> {
  const tg = await prisma.targetGroup.findUnique({
    where: { id: targetGroupId },
    select: {
      tenantId: true,
      name: true,
      key: true,
      _count: { select: { registrations: true } },
    },
  });

  if (!tg || (tg.tenantId !== null && tg.tenantId !== tenantId)) return null;

  const impact: TargetGroupDeletionImpact = {
    linkedRegistrations: tg._count.registrations,
  };

  await prisma.targetGroup.delete({ where: { id: targetGroupId } });

  return {
    targetGroupId,
    name: tg.name,
    key: tg.key,
    impact,
  };
}
