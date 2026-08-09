/**
 * TEAMCENTER-UX-01 — Team lifecycle service.
 *
 * Centralizes the archive / restore / safe-delete rules for the tenant-owned
 * Team model. Team has no dedicated `archivedAt` column (unlike OrgUnit /
 * Competition / ExternalTeam) — archival reuses the existing `isActive`
 * boolean, which downstream consumers (e.g. lib/training/queries.ts
 * findEligibleTeamsForTraining) already treat as the "excluded from active
 * selectors" gate. Reusing it keeps this additive-schema-free and consistent
 * with existing semantics instead of introducing a second, competing flag.
 *
 * All functions are strictly tenant-scoped — every read/write takes a
 * trusted `tenantId` (never client-supplied) and never touches a Team
 * belonging to a different tenant.
 */
import { prisma } from "@/lib/db/prisma";

export class TeamNotFoundError extends Error {
  constructor() {
    super("Team nicht gefunden.");
    this.name = "TeamNotFoundError";
  }
}

export type TeamDeletionBlocker = {
  key: string;
  label: string;
  count: number;
};

export class TeamDeletionBlockedError extends Error {
  blockers: TeamDeletionBlocker[];

  constructor(blockers: TeamDeletionBlocker[]) {
    super(
      "Team kann nicht gelöscht werden, da bestehende Daten/Historie vorhanden sind. Bitte stattdessen archivieren.",
    );
    this.name = "TeamDeletionBlockedError";
    this.blockers = blockers;
  }
}

/**
 * Computes the deletion blockers for a Team, strictly scoped to `tenantId`.
 * Returns null when the Team does not exist (or belongs to another tenant).
 *
 * "Meaningful dependency" definition (deliberately conservative — a freshly
 * registered, never-used Team must remain deletable):
 *   - more than one TeamSeason (i.e. the Team has lived across seasons —
 *     historical continuity, not just its current-season placement)
 *   - any roster data (squad / trainer members) on any of its TeamSeasons
 *   - any recurring training (TrainingSeries / TrainingSession)
 *   - any competition assignment (TeamSeasonCompetition)
 *   - any scheduled Event / EventImportRun referencing the Team directly
 *   - any Match opponent mapping (home or away)
 *   - any tournament participation
 *   - any provider/SFV mapping (Team- or TeamSeason-level)
 *   - any OrgUnit (organisation) assignment on any of its TeamSeasons
 */
export async function getTeamDeletionBlockers(
  tenantId: string,
  teamId: string,
): Promise<TeamDeletionBlocker[] | null> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: {
      _count: {
        select: {
          events: true,
          eventImportRuns: true,
          homeMatchMappings: true,
          awayMatchMappings: true,
          tournamentParticipations: true,
          externalMappings: true,
        },
      },
      teamSeasons: {
        select: {
          _count: {
            select: {
              playerSquadMembers: true,
              trainerTeamMembers: true,
              trainingSeries: true,
              trainingSessions: true,
              competitions: true,
              externalMappings: true,
              orgUnits: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    return null;
  }

  const seasonTotals = team.teamSeasons.reduce(
    (acc, entry) => {
      acc.playerSquadMembers += entry._count.playerSquadMembers;
      acc.trainerTeamMembers += entry._count.trainerTeamMembers;
      acc.trainingSeries += entry._count.trainingSeries;
      acc.trainingSessions += entry._count.trainingSessions;
      acc.competitions += entry._count.competitions;
      acc.externalMappings += entry._count.externalMappings;
      acc.orgUnits += entry._count.orgUnits;
      return acc;
    },
    {
      playerSquadMembers: 0,
      trainerTeamMembers: 0,
      trainingSeries: 0,
      trainingSessions: 0,
      competitions: 0,
      externalMappings: 0,
      orgUnits: 0,
    },
  );

  const blockers: TeamDeletionBlocker[] = [];

  const push = (key: string, label: string, count: number) => {
    if (count > 0) blockers.push({ key, label, count });
  };

  push(
    "seasons",
    "Zuordnung zu mehreren Saisons",
    team.teamSeasons.length > 1 ? team.teamSeasons.length : 0,
  );
  push("squad", "Kadermitglieder (Spieler)", seasonTotals.playerSquadMembers);
  push("trainers", "Trainer-/Staffmitglieder", seasonTotals.trainerTeamMembers);
  push("trainingSeries", "Trainingsserien", seasonTotals.trainingSeries);
  push("trainingSessions", "Trainingseinheiten", seasonTotals.trainingSessions);
  push("competitions", "Wettkampf-/Liga-Zuordnungen", seasonTotals.competitions);
  push("events", "Termine (Events)", team._count.events);
  push("eventImportRuns", "Event-Importläufe", team._count.eventImportRuns);
  push(
    "matches",
    "Spielpaarungen (Heim/Auswärts)",
    team._count.homeMatchMappings + team._count.awayMatchMappings,
  );
  push("tournaments", "Turnierteilnahmen", team._count.tournamentParticipations);
  push(
    "providerMappings",
    "Anbieter-/SFV-Zuordnungen",
    team._count.externalMappings + seasonTotals.externalMappings,
  );
  push("orgUnits", "Organisationseinheiten-Zuordnungen", seasonTotals.orgUnits);

  return blockers;
}

/** Soft-archives a Team (sets isActive=false). Strictly tenant-scoped. */
export async function archiveTeam(tenantId: string, teamId: string) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, tenantId } });
  if (!existing) throw new TeamNotFoundError();

  return prisma.team.update({
    where: { id: teamId },
    data: { isActive: false },
  });
}

/** Restores a previously archived Team (sets isActive=true). Strictly tenant-scoped. */
export async function restoreTeam(tenantId: string, teamId: string) {
  const existing = await prisma.team.findFirst({ where: { id: teamId, tenantId } });
  if (!existing) throw new TeamNotFoundError();

  return prisma.team.update({
    where: { id: teamId },
    data: { isActive: true },
  });
}

/**
 * Hard-deletes a Team only when no meaningful dependency/history exists.
 * Throws TeamNotFoundError or TeamDeletionBlockedError otherwise.
 * Strictly tenant-scoped.
 */
export async function deleteTeamSafely(tenantId: string, teamId: string) {
  const blockers = await getTeamDeletionBlockers(tenantId, teamId);
  if (blockers === null) throw new TeamNotFoundError();
  if (blockers.length > 0) throw new TeamDeletionBlockedError(blockers);

  // No historical children beyond a single, empty TeamSeason — safe to
  // cascade-delete (Team -> TeamSeason -> TeamSeasonOrgUnit is Cascade in
  // schema; every other historical relation was already confirmed empty).
  return prisma.team.delete({ where: { id: teamId } });
}
