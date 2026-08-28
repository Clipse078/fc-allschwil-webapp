/**
 * lib/teams/team-cockpit-sporting-data.ts
 *
 * Authenticated Team Cockpit sporting read model. Composes canonical internal
 * domain/query services — never the public website API.
 */

import { prisma } from "@/lib/db/prisma";
import { fetchTeamStandingsForMapping } from "@/lib/integrations/sfv/standings-provider";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import {
  listTeamSeasonMatches,
  type TeamMatchQueryDatabase,
  type TeamSeasonMatchItem,
} from "@/lib/teams/team-match-query-service";
import {
  resolveTeamCompetitionDisplay,
  resolveCurrentSeasonSfvMapping,
  type TeamCanonicalCompetitionContext,
  type TeamCompetitionDisplay,
} from "@/lib/teams/team-competition-display";
import type { SportingMatchLifecycle } from "@/lib/sporting-data/lifecycle";
import type { TeamSeasonMatchCompetitionContext } from "@/lib/teams/team-match-query-service";
import {
  filterPublicTeamNextMatches,
  filterPublicTeamResults,
  resolvePublicTeamResultPerspective,
} from "@/lib/website/public-team-matches-mapper";

export const TEAM_COCKPIT_NEXT_MATCHES_DEFAULT_LIMIT = 5;
export const TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT = 10;
export const TEAM_COCKPIT_RESULTS_DEFAULT_LIMIT = 5;
export const TEAM_COCKPIT_RESULTS_DETAIL_LIMIT = 10;

export type TeamCockpitMatchSide = {
  displayName: string;
  isOwnTeam: boolean;
};

export type TeamCockpitMatch = {
  eventId: string;
  startAt: Date;
  side: "HOME" | "AWAY";
  status: string;
  lifecycle: SportingMatchLifecycle;
  opponentName: string;
  home: TeamCockpitMatchSide;
  away: TeamCockpitMatchSide;
  venueName: string | null;
  location: string | null;
  competitionName: string | null;
};

export type TeamCockpitResultPerspective = "WON" | "DRAW" | "LOST" | "UNKNOWN";

export type TeamCockpitResult = TeamCockpitMatch & {
  scoreHome: number | null;
  scoreAway: number | null;
  teamScore: number | null;
  opponentScore: number | null;
  resultPerspective: TeamCockpitResultPerspective;
};

export type TeamCockpitStandingsRow = {
  position: number;
  teamName: string;
  shortName: string | null;
  isCurrentTeam: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  penaltyPoints: number | null;
};

export type TeamCockpitStandings = {
  competition: TeamCompetitionDisplay;
  rows: TeamCockpitStandingsRow[];
};

export type TeamCockpitSportingData = {
  competition: TeamCompetitionDisplay | null;
  nextMatches: TeamCockpitMatch[];
  results: TeamCockpitResult[];
  standings: TeamCockpitStandings | null;
};

export type GetTeamCockpitSportingDataInput = {
  tenantId: string;
  teamId: string;
  teamSeasonId: string;
  seasonKey: string;
  teamDisplayName: string;
  teamShortName?: string | null;
  canonicalCompetition?: TeamCanonicalCompetitionContext | null;
  sfvMapping?: {
    externalTeamId: number;
    externalSeasonId: number;
    providerLeagueId?: number | null;
    providerLeagueName?: string | null;
  } | null;
  now?: Date;
  limits?: {
    nextMatches?: number;
    results?: number;
  };
  database?: TeamMatchQueryDatabase;
};

function meaningful(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveCockpitMatchCompetitionName(
  competition: TeamSeasonMatchCompetitionContext,
): string | null {
  return (
    meaningful(competition.eventCompetitionLabel) ??
    meaningful(competition.canonicalCompetitionName) ??
    meaningful(competition.canonicalCompetitionShortName) ??
    meaningful(competition.providerLeagueName) ??
    meaningful(competition.providerDivisionName)
  );
}

function mapCockpitMatchSide(
  side: TeamSeasonMatchItem["home"],
  ownTeamId: string,
): TeamCockpitMatchSide {
  return {
    displayName: side.displayName,
    isOwnTeam: side.canonicalTeamId === ownTeamId,
  };
}

function mapCockpitMatch(item: TeamSeasonMatchItem, ownTeamId: string): TeamCockpitMatch {
  return {
    eventId: item.eventId,
    startAt: item.startAt,
    side: item.side,
    status: item.status,
    lifecycle: item.lifecycle,
    opponentName: item.opponent.displayName,
    home: mapCockpitMatchSide(item.home, ownTeamId),
    away: mapCockpitMatchSide(item.away, ownTeamId),
    venueName: item.venueName,
    location: item.location,
    competitionName: resolveCockpitMatchCompetitionName(item.competition),
  };
}

function mapCockpitResult(item: TeamSeasonMatchItem, ownTeamId: string): TeamCockpitResult {
  const teamScore = item.side === "HOME" ? item.scoreHome : item.scoreAway;
  const opponentScore = item.side === "HOME" ? item.scoreAway : item.scoreHome;

  return {
    ...mapCockpitMatch(item, ownTeamId),
    scoreHome: item.scoreHome,
    scoreAway: item.scoreAway,
    teamScore,
    opponentScore,
    resultPerspective: resolvePublicTeamResultPerspective(item),
  };
}

/**
 * Loads Team Cockpit-ready sporting data for the current TeamSeason.
 *
 * - Tenant-safe and season-scoped via canonical query services.
 * - Not restricted by websiteVisible.
 * - Standings failures are isolated — competition still falls back to mapping.
 */
export async function getTeamCockpitSportingData(
  input: GetTeamCockpitSportingDataInput,
): Promise<TeamCockpitSportingData> {
  const database = input.database ?? (prisma as unknown as TeamMatchQueryDatabase);
  const now = input.now ?? new Date();
  const nextMatchesLimit =
    input.limits?.nextMatches ?? TEAM_COCKPIT_NEXT_MATCHES_DEFAULT_LIMIT;
  const resultsLimit = input.limits?.results ?? TEAM_COCKPIT_RESULTS_DEFAULT_LIMIT;

  const { upcoming, completed } = await listTeamSeasonMatches(database, {
    tenantId: input.tenantId,
    teamSeasonId: input.teamSeasonId,
    now,
  });

  const nextMatches = filterPublicTeamNextMatches(upcoming, now, nextMatchesLimit).map((item) =>
    mapCockpitMatch(item, input.teamId),
  );
  const results = filterPublicTeamResults(completed, resultsLimit).map((item) =>
    mapCockpitResult(item, input.teamId),
  );

  let standings: TeamCockpitStandings | null = null;
  let standingsCompetition = null;

  if (input.sfvMapping) {
    let standingsTable = null;
    try {
      standingsTable = await fetchTeamStandingsForMapping({
        tenantId: input.tenantId,
        externalTeamId: input.sfvMapping.externalTeamId,
        externalSeasonId: input.sfvMapping.externalSeasonId,
        providerLeagueId: input.sfvMapping.providerLeagueId,
      });
    } catch {
      standingsTable = null;
    }

    if (standingsTable) {
      standingsCompetition = standingsTable.competition;
      const standingsCompetitionDisplay = resolveTeamCompetitionDisplay({
        standingsCompetition: standingsTable.competition,
        providerLeagueName: input.sfvMapping.providerLeagueName,
        canonicalCompetition: input.canonicalCompetition,
      });

      if (standingsCompetitionDisplay) {
        standings = {
          competition: standingsCompetitionDisplay,
          rows: standingsTable.rows.map((row) => ({
          position: row.position,
          teamName: row.teamName,
          shortName:
            row.externalTeamId === input.sfvMapping!.externalTeamId
              ? input.teamShortName ?? row.shortName
              : row.shortName,
          isCurrentTeam: row.externalTeamId === input.sfvMapping!.externalTeamId,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalsFor - row.goalsAgainst,
          points: row.points,
          penaltyPoints: row.penaltyPoints,
        })),
        };
      }
    }
  }

  const competition =
    standings?.competition ??
    resolveTeamCompetitionDisplay({
      standingsCompetition: standingsCompetition,
      providerLeagueName: input.sfvMapping?.providerLeagueName,
      canonicalCompetition: input.canonicalCompetition,
    });

  return {
    competition,
    nextMatches,
    results,
    standings,
  };
}

export type LoadCurrentSeasonSfvMappingInput = {
  tenantId: string;
  teamSeasonId: string;
  seasonKey: string;
};

export type CurrentSeasonSfvMappingData = {
  externalTeamId: number;
  externalSeasonId: number;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerTeamName: string | null;
  lastSyncedAt: Date;
};

/**
 * Tenant-safe loader for the current-season SFV mapping used by cockpit queries.
 */
const currentSeasonSfvMappingSelect = {
  externalTeamId: true,
  externalSeasonId: true,
  providerLeagueId: true,
  providerLeagueName: true,
  providerTeamName: true,
  lastSyncedAt: true,
  teamSeasonId: true,
  provider: true,
} as const;

function mapCurrentSeasonSfvMapping(
  mapping: {
    externalTeamId: number;
    externalSeasonId: number;
    providerLeagueId: number | null;
    providerLeagueName: string | null;
    providerTeamName: string | null;
    lastSyncedAt: Date;
    teamSeasonId: string | null;
    provider: string;
  } | null,
  input: LoadCurrentSeasonSfvMappingInput,
): CurrentSeasonSfvMappingData | null {
  const seasonSafeMapping = resolveCurrentSeasonSfvMapping(mapping, {
    teamSeasonId: input.teamSeasonId,
    seasonKey: input.seasonKey,
  });

  if (!seasonSafeMapping) {
    return null;
  }

  return {
    externalTeamId: seasonSafeMapping.externalTeamId,
    externalSeasonId: seasonSafeMapping.externalSeasonId,
    providerLeagueId: seasonSafeMapping.providerLeagueId,
    providerLeagueName: seasonSafeMapping.providerLeagueName,
    providerTeamName: mapping?.providerTeamName ?? null,
    lastSyncedAt: mapping!.lastSyncedAt,
  };
}

export async function loadCurrentSeasonSfvMapping(
  input: LoadCurrentSeasonSfvMappingInput,
): Promise<CurrentSeasonSfvMappingData | null> {
  const mapping = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId: input.tenantId,
      teamSeasonId: input.teamSeasonId,
      provider: SFV_PROVIDER,
      providerIsActive: true,
    },
    select: currentSeasonSfvMappingSelect,
  });

  return mapCurrentSeasonSfvMapping(mapping, input);
}

export type LoadCurrentSeasonSfvMappingsForListInput = {
  tenantId: string;
  entries: Array<{
    teamSeasonId: string;
    seasonKey: string;
  }>;
};

/**
 * Batch loader for teams-list competition resolution. Avoids per-row DB calls
 * while preserving the same season/tenant-safe mapping rules as the detail path.
 */
export async function loadCurrentSeasonSfvMappingsForList(
  input: LoadCurrentSeasonSfvMappingsForListInput,
): Promise<Map<string, Pick<CurrentSeasonSfvMappingData, "providerLeagueName">>> {
  const teamSeasonIds = input.entries.map((entry) => entry.teamSeasonId);
  const result = new Map<string, Pick<CurrentSeasonSfvMappingData, "providerLeagueName">>();

  if (teamSeasonIds.length === 0) {
    return result;
  }

  const mappings = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId: input.tenantId,
      teamSeasonId: { in: teamSeasonIds },
      provider: SFV_PROVIDER,
      providerIsActive: true,
    },
    select: currentSeasonSfvMappingSelect,
  });

  const mappingsByTeamSeasonId = new Map(
    mappings
      .filter((mapping): mapping is typeof mapping & { teamSeasonId: string } => mapping.teamSeasonId !== null)
      .map((mapping) => [mapping.teamSeasonId, mapping]),
  );

  for (const entry of input.entries) {
    const mapping = mapCurrentSeasonSfvMapping(mappingsByTeamSeasonId.get(entry.teamSeasonId) ?? null, {
      tenantId: input.tenantId,
      teamSeasonId: entry.teamSeasonId,
      seasonKey: entry.seasonKey,
    });

    if (mapping) {
      result.set(entry.teamSeasonId, {
        providerLeagueName: mapping.providerLeagueName,
      });
    }
  }

  return result;
}
