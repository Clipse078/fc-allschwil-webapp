/**
 * lib/participation/authorization.ts
 *
 * TEAM-COCKPIT-03A — actor authorization for participation responses.
 *
 * Never trusts client-supplied tenantId or arbitrary personId.
 * Derives allowed person scope from authenticated user relationships.
 */

import { prisma } from "@/lib/db/prisma";
import type { ParticipationResponseSource } from "@prisma/client";
import { ParticipationUnauthorizedError } from "./errors";

export type ParticipationActorContext = {
  source: ParticipationResponseSource;
  actorPersonId: string | null;
};

/**
 * Resolves whether an authenticated user may respond for a given player.
 * Fails closed when no valid player/parent relationship exists.
 */
export async function assertActorCanRespondForPerson(
  tenantId: string,
  actorUserId: string,
  personId: string,
): Promise<ParticipationActorContext> {
  const actorPerson = await prisma.person.findFirst({
    where: { userId: actorUserId, tenantId },
    select: { id: true },
  });

  if (actorPerson?.id === personId) {
    return { source: "PLAYER", actorPersonId: actorPerson.id };
  }

  if (actorPerson) {
    const guardianLink = await prisma.guardianRelationship.findFirst({
      where: {
        tenantId,
        childPersonId: personId,
        guardianPersonId: actorPerson.id,
      },
      select: { id: true },
    });

    if (guardianLink) {
      return { source: "PARENT", actorPersonId: actorPerson.id };
    }
  }

  throw new ParticipationUnauthorizedError();
}

/**
 * Returns person IDs the authenticated user may respond for (self + guardian children).
 */
export async function getAuthorizedPersonIdsForUser(
  tenantId: string,
  actorUserId: string,
): Promise<string[]> {
  const actorPerson = await prisma.person.findFirst({
    where: { userId: actorUserId, tenantId },
    select: { id: true },
  });

  if (!actorPerson) {
    return [];
  }

  const guardianChildren = await prisma.guardianRelationship.findMany({
    where: {
      tenantId,
      guardianPersonId: actorPerson.id,
    },
    select: { childPersonId: true },
  });

  const personIds = new Set<string>([actorPerson.id]);
  for (const link of guardianChildren) {
    personIds.add(link.childPersonId);
  }

  return [...personIds];
}
