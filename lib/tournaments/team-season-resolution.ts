/**
 * Exact, tenant-safe TeamSeason resolution for a tournament's legacy
 * (teamId, seasonId) association. Names and participant labels are never
 * considered.
 */

import { prisma } from "@/lib/db/prisma";
import { TournamentValidationError } from "./errors";

export async function resolveTournamentTeamSeasonId(
  tenantId: string,
  teamId: string,
  seasonId: string | null,
): Promise<string> {
  if (!seasonId) {
    throw new TournamentValidationError(
      "A tournament with a team requires a season.",
    );
  }

  // `take: 2` preserves fail-closed behavior even if a database has drifted
  // from the formal @@unique([teamId, seasonId]) schema constraint.
  const candidates = await prisma.teamSeason.findMany({
    where: {
      teamId,
      seasonId,
      team: { tenantId },
    },
    select: { id: true },
    take: 2,
  });

  if (candidates.length === 0) {
    throw new TournamentValidationError(
      "No tenant-owned TeamSeason matches the selected team and season.",
    );
  }

  if (candidates.length > 1) {
    throw new TournamentValidationError(
      "Multiple TeamSeason records match the selected team and season.",
    );
  }

  return candidates[0]!.id;
}
