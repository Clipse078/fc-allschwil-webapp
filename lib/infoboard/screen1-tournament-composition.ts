/**
 * lib/infoboard/screen1-tournament-composition.ts
 *
 * Prisma-backed composition helpers for Screen 1 tournament logo presentation.
 * Confined to Infoboard composition boundaries (pages, preview, public API).
 */

import { prisma } from "@/lib/db/prisma";
import { resolveOrganizerClubsByName } from "@/lib/tournaments/organizer-club-resolver";
import type { Screen1TournamentPresentationDatabase } from "@/lib/publishing/infoboard/screen1-tournament-presentation";

export function createScreen1TournamentPresentationDatabase(): Screen1TournamentPresentationDatabase {
  return {
    tournamentParticipant: {
      findMany: (args) =>
        prisma.tournamentParticipant.findMany(
          args as Parameters<typeof prisma.tournamentParticipant.findMany>[0],
        ) as unknown as ReturnType<
          Screen1TournamentPresentationDatabase["tournamentParticipant"]["findMany"]
        >,
    },
  };
}

export function resolveScreen1OrganizerClubsByName(
  tenantId: string,
  organizerNames: readonly string[],
) {
  return resolveOrganizerClubsByName(tenantId, organizerNames);
}
