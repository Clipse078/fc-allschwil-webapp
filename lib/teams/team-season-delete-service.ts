/**
 * lib/teams/team-season-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — TeamSeason permanent hard-delete service.
 *
 * Authorization: reuses TEAMS_DELETE (same permission as Team deletion).
 * Tenant resolved via TeamSeason → Team → tenantId server-side.
 *
 * CASCADE BEHAVIOR (automatic via Prisma schema onDelete):
 *   • TeamSeasonOrgUnit — Cascade
 *   • PlayerSquadMember — Cascade (Person preserved)
 *   • TrainerTeamMember — Cascade (Person preserved)
 *   • TeamSeasonCompetition — Cascade (Competition preserved)
 *   • TrainingSeries — Cascade (→ TrainingSession → TrainingAllocation → cascade)
 *   • TrainingSession — Cascade (double-cascaded via TrainingSeries + direct)
 *   • TeamExternalMapping.teamSeasonId — SetNull (mapping preserved)
 *
 * NON-FK CLEANUP (deliberate pre-delete in transaction):
 *   WeekplannerPlanAllocation and WeekplannerPlanActivityOverride store
 *   TrainingSession.id in activityId as a raw string (NOT a DB FK —
 *   see prisma/schema.prisma WeekplannerPlanAllocation doc comment).
 *   These must be explicitly deleted before the TeamSeason is removed,
 *   otherwise they become permanently stale dangling references.
 *
 * PRESERVED: Team, Persons, OrgUnits, Competitions, TeamExternalMappings.
 */

import { prisma } from "@/lib/db/prisma";

export type TeamSeasonDeletionImpact = {
  /** TeamSeason display name */
  displayName: string;
  /** Canonical Season name */
  seasonName: string;
  /** PlayerSquadMember rows — will be cascade-deleted (Persons preserved) */
  squadMembers: number;
  /** TrainerTeamMember rows — will be cascade-deleted (Persons preserved) */
  trainerMembers: number;
  /** TrainingSeries rows — will be cascade-deleted */
  trainingSeries: number;
  /** TrainingSession rows — will be cascade-deleted */
  trainingSessions: number;
  /** WeekplannerPlanAllocation rows referencing these sessions — explicitly deleted */
  weekplannerAllocations: number;
  /** WeekplannerPlanActivityOverride rows referencing these sessions — explicitly deleted */
  weekplannerOverrides: number;
  /** TeamSeasonCompetition rows — will be cascade-deleted (Competitions preserved) */
  competitionAssignments: number;
  /** TeamExternalMapping rows with teamSeasonId set — will be nulled (SetNull) */
  externalMappings: number;
  /** Tenant ID resolved from Team (never from client) */
  tenantId: string;
};

export type TeamSeasonDeletionResult = {
  teamSeasonId: string;
  displayName: string;
  seasonName: string;
  impact: TeamSeasonDeletionImpact;
};

/**
 * Returns the deletion impact for a TeamSeason.
 * Returns null when the TeamSeason does not exist.
 * Never mutates.
 */
export async function getTeamSeasonDeletionImpact(
  teamSeasonId: string,
): Promise<TeamSeasonDeletionImpact | null> {
  const teamSeason = await prisma.teamSeason.findUnique({
    where: { id: teamSeasonId },
    select: {
      displayName: true,
      season: { select: { name: true } },
      team: { select: { tenantId: true } },
      _count: {
        select: {
          playerSquadMembers: true,
          trainerTeamMembers: true,
          trainingSeries: true,
          trainingSessions: true,
          competitions: true,
          externalMappings: true,
        },
      },
    },
  });

  if (!teamSeason || !teamSeason.team.tenantId) return null;

  // Collect training session IDs to count non-FK weekplanner references.
  const sessions = await prisma.trainingSession.findMany({
    where: { teamSeasonId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  const [weekplannerAllocations, weekplannerOverrides] =
    sessionIds.length > 0
      ? await Promise.all([
          prisma.weekplannerPlanAllocation.count({
            where: {
              tenantId: teamSeason.team.tenantId,
              activityType: "TRAINING",
              activityId: { in: sessionIds },
            },
          }),
          prisma.weekplannerPlanActivityOverride.count({
            where: {
              tenantId: teamSeason.team.tenantId,
              activityType: "TRAINING",
              activityId: { in: sessionIds },
            },
          }),
        ])
      : [0, 0];

  return {
    displayName: teamSeason.displayName,
    seasonName: teamSeason.season.name,
    squadMembers: teamSeason._count.playerSquadMembers,
    trainerMembers: teamSeason._count.trainerTeamMembers,
    trainingSeries: teamSeason._count.trainingSeries,
    trainingSessions: teamSeason._count.trainingSessions,
    weekplannerAllocations,
    weekplannerOverrides,
    competitionAssignments: teamSeason._count.competitions,
    externalMappings: teamSeason._count.externalMappings,
    tenantId: teamSeason.team.tenantId,
  };
}

/**
 * Permanently deletes a TeamSeason.
 *
 * Transaction steps:
 *   1. Explicit cleanup: WeekplannerPlanAllocation + WeekplannerPlanActivityOverride
 *      rows that reference TrainingSession.id (non-FK, must be pre-cleaned)
 *   2. TeamSeason delete (all cascade/SetNull handled by Prisma schema)
 *
 * Returns null when the TeamSeason does not exist (idempotent-safe).
 */
export async function deleteTeamSeasonPermanently(
  teamSeasonId: string,
): Promise<TeamSeasonDeletionResult | null> {
  const impact = await getTeamSeasonDeletionImpact(teamSeasonId);
  if (impact === null) return null;

  // Collect session IDs before deleting (must be done outside transaction).
  const sessions = await prisma.trainingSession.findMany({
    where: { teamSeasonId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    // Step 1: Non-FK weekplanner cleanup (activityId is raw string, not a DB relation).
    if (sessionIds.length > 0) {
      await tx.weekplannerPlanAllocation.deleteMany({
        where: {
          tenantId: impact.tenantId,
          activityType: "TRAINING",
          activityId: { in: sessionIds },
        },
      });
      await tx.weekplannerPlanActivityOverride.deleteMany({
        where: {
          tenantId: impact.tenantId,
          activityType: "TRAINING",
          activityId: { in: sessionIds },
        },
      });
    }

    // Step 2: Delete TeamSeason. Schema cascades:
    //   TeamSeasonOrgUnit, PlayerSquadMember, TrainerTeamMember,
    //   TeamSeasonCompetition, TrainingSeries → TrainingSession,
    //   TrainingSession (direct). SetNull: TeamExternalMapping.teamSeasonId.
    await tx.teamSeason.delete({ where: { id: teamSeasonId } });
  });

  return {
    teamSeasonId,
    displayName: impact.displayName,
    seasonName: impact.seasonName,
    impact,
  };
}
