/**
 * lib/initiatives/initiative-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — Initiative permanent hard-delete service.
 *
 * Design principles:
 *   • Impact preview never mutates.
 *   • Initiative has no child sub-entities (no cascade relations in schema).
 *   • No tenantId on Initiative — authorization is caller-resolved via
 *     hasTenantDeletionAuthority() using the actor's active tenant.
 *   • A single prisma.initiative.delete() is sufficient.
 */

import { prisma } from "@/lib/db/prisma";

export type InitiativeDeletionImpact = {
  /** No cascade sub-entities — this is always an empty impact preview. */
  hasNoCascadeChildren: true;
};

export type InitiativeDeletionResult = {
  initiativeId: string;
  title: string;
  impact: InitiativeDeletionImpact;
};

/**
 * Returns the deletion impact for an Initiative.
 * Returns null when the initiative does not exist.
 * Never mutates.
 */
export async function getInitiativeDeletionImpact(
  initiativeId: string,
): Promise<InitiativeDeletionImpact | null> {
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { id: true },
  });

  if (!initiative) return null;

  return { hasNoCascadeChildren: true };
}

/**
 * Permanently deletes an Initiative.
 * Returns null when the initiative does not exist (idempotent-safe).
 */
export async function deleteInitiativePermanently(
  initiativeId: string,
): Promise<InitiativeDeletionResult | null> {
  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { title: true },
  });

  if (!initiative) return null;

  await prisma.initiative.delete({ where: { id: initiativeId } });

  return {
    initiativeId,
    title: initiative.title,
    impact: { hasNoCascadeChildren: true },
  };
}
