/**
 * lib/tournaments/organizer-club-resolver.ts
 *
 * TOURNAMENT-LOGOS-01A — tenant-scoped batch lookup of organizer clubs in the
 * canonical Club Directory. Used when Event.organizerName is free text and no
 * organizerExternalClubId FK exists yet.
 */

import { prisma } from "@/lib/db/prisma";
import {
  buildOrganizerClubLookupIndex,
  lookupOrganizerClub,
  type ResolvedOrganizerClub,
} from "./club-identity";

const ORGANIZER_CLUB_SELECT = {
  id: true,
  name: true,
  shortName: true,
  alternativeName: true,
  logoUrl: true,
} as const;

/**
 * Loads all non-archived ExternalClub rows for a tenant and builds a lookup
 * index keyed by normalized club names.
 */
export async function loadOrganizerClubLookupIndex(
  tenantId: string,
): Promise<ReadonlyMap<string, ResolvedOrganizerClub>> {
  const clubs = await prisma.externalClub.findMany({
    where: { tenantId, archivedAt: null },
    select: ORGANIZER_CLUB_SELECT,
  });
  return buildOrganizerClubLookupIndex(clubs);
}

/**
 * Resolves organizer clubs for the given organizer names within one tenant.
 * Returns a map keyed by the original trimmed organizerName string.
 */
export async function resolveOrganizerClubsByName(
  tenantId: string,
  organizerNames: readonly string[],
): Promise<ReadonlyMap<string, ResolvedOrganizerClub>> {
  const trimmedNames = [
    ...new Set(
      organizerNames
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  if (trimmedNames.length === 0) {
    return new Map();
  }

  const index = await loadOrganizerClubLookupIndex(tenantId);
  const resolved = new Map<string, ResolvedOrganizerClub>();

  for (const name of trimmedNames) {
    const club = lookupOrganizerClub(name, index);
    if (club) {
      resolved.set(name, club);
    }
  }

  return resolved;
}
