/**
 * lib/competitions/competition-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI-UPLIFT — Competition permanent hard-delete service.
 *
 * The `TeamSeasonCompetition` FK has `onDelete: Restrict` on the Competition
 * side — this prevents direct deletion of a Competition that has
 * TeamSeasonCompetition rows. The solution is to pre-clean those link rows
 * inside a transaction before deleting the Competition.
 *
 * PRESERVED: TeamSeason, Team, all other related data.
 * DELETED:   TeamSeasonCompetition rows for this competition, then Competition.
 *
 * TeamExternalMapping.mappingCompetitionId → onDelete: SetNull (automatic).
 */

import { prisma } from "@/lib/db/prisma";

export type CompetitionDeletionImpact = {
  officialName: string;
  shortName: string | null;
  /** TeamSeasonCompetition rows for this competition — will be pre-cleaned (TeamSeason preserved) */
  teamSeasonAssignments: number;
  /** TeamExternalMapping rows using this as mapping context — mappingCompetitionId nulled (SetNull) */
  externalMappingContexts: number;
};

export type CompetitionDeletionResult = {
  competitionId: string;
  officialName: string;
  impact: CompetitionDeletionImpact;
};

/**
 * Returns the deletion impact for a Competition within the given tenant.
 * Returns null when the competition does not exist or belongs to a different tenant.
 * Never mutates.
 */
export async function getCompetitionDeletionImpact(
  tenantId: string,
  competitionId: string,
): Promise<CompetitionDeletionImpact | null> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      tenantId: true,
      officialName: true,
      shortName: true,
      _count: {
        select: {
          teamSeasonCompetitions: true,
          teamExternalMappings: true,
        },
      },
    },
  });

  if (!competition || competition.tenantId !== tenantId) return null;

  return {
    officialName: competition.officialName,
    shortName: competition.shortName,
    teamSeasonAssignments: competition._count.teamSeasonCompetitions,
    externalMappingContexts: competition._count.teamExternalMappings,
  };
}

/**
 * Permanently deletes a Competition within the given tenant.
 *
 * Transaction steps:
 *   1. Delete TeamSeasonCompetition rows (Restrict FK requires explicit cleanup)
 *   2. Delete Competition (TeamExternalMapping.mappingCompetitionId → SetNull automatic)
 *
 * Returns null when the competition does not exist in the tenant (idempotent-safe).
 */
export async function deleteCompetitionPermanently(
  tenantId: string,
  competitionId: string,
): Promise<CompetitionDeletionResult | null> {
  const impact = await getCompetitionDeletionImpact(tenantId, competitionId);
  if (impact === null) return null;

  await prisma.$transaction(async (tx) => {
    // Step 1: Remove TeamSeasonCompetition links (Restrict FK — must precede Competition delete).
    await tx.teamSeasonCompetition.deleteMany({ where: { competitionId } });

    // Step 2: Delete the Competition.
    // TeamExternalMapping.mappingCompetitionId → SetNull automatically.
    await tx.competition.delete({ where: { id: competitionId } });
  });

  return {
    competitionId,
    officialName: impact.officialName,
    impact,
  };
}
