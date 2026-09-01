/**
 * lib/teams/team-cockpit-sporting-data.ts
 *
 * Authenticated Team Cockpit sporting read model. Composes canonical internal
 * domain/query services — never the public website API.
 */

import { prisma } from "@/lib/db/prisma";
import { resolveStandingsForMapping } from "@/lib/integrations/sfv/standings-resolution";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import {
  listTeamSeasonMatches,
  type TeamMatchQueryDatabase,
  type TeamSeasonMatchItem,
} from "@/lib/teams/team-match-query-service";
import {
  resolveTeamCompetitionDisplay,
  type TeamCanonicalCompetitionContext,
  type TeamCompetitionDisplay,
} from "@/lib/teams/team-competition-display";
import {
  effectiveTeamStandingsMappingSelect,
  loadEffectiveTeamStandingsMapping,
  resolveEffectiveTeamStandingsMapping,
  type EffectiveTeamStandingsMapping,
  type ResolveEffectiveTeamStandingsMappingInput,
} from "@/lib/teams/team-standings-mapping";
import type { SportingMatchLifecycle } from "@/lib/sporting-data/lifecycle";
import type { TeamSeasonMatchCompetitionContext } from "@/lib/teams/team-match-query-service";
import {
  filterPublicTeamNextMatches,
  filterPublicTeamResults,
  resolvePublicTeamResultPerspective,
} from "@/lib/website/public-team-matches-mapper";
import {
  buildStandingsClubEnrichmentByProviderTeamId,
  type StandingsClubEnrichment,
  type StandingsClubEnrichmentDatabase,
} from "@/lib/club-directory/standings-club-enrichment";
import { presentStandingsRows } from "@/lib/sporting-data/standings-row-presentation";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";

export const TEAM_COCKPIT_NEXT_MATCHES_DEFAULT_LIMIT = 5;
export const TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT = 10;
export const TEAM_COCKPIT_RESULTS_DEFAULT_LIMIT = 5;
export const TEAM_COCKPIT_RESULTS_DETAIL_LIMIT = 10;

export type TeamCockpitMatchSide = {
  displayName: string;
  isOwnTeam: boolean;
  clubName: string | null;
  logoUrl: string | null;
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
  logoUrl: string | null;
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
  tenantClubName?: string | null;
  tenantLogoUrl?: string | null;
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
  identityDatabase?: TeamCockpitIdentityDatabase;
};

export type TeamCockpitIdentityDatabase = StandingsClubEnrichmentDatabase;

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
  tenantClubName: string | null | undefined,
  tenantLogoUrl: string | null | undefined,
): TeamCockpitMatchSide {
  const isOwnTeam = side.canonicalTeamId === ownTeamId;
  const isInternalTeam = side.canonicalTeamId !== null;

  return {
    displayName: side.displayName,
    isOwnTeam,
    clubName: isInternalTeam ? meaningful(tenantClubName) : side.clubName,
    logoUrl: resolveClubIdentityLogoUrl(
      {
        isOwnTeam: isInternalTeam,
        externalLogoUrl: side.externalLogoUrl,
      },
      tenantLogoUrl,
    ),
  };
}

function mapCockpitMatch(
  item: TeamSeasonMatchItem,
  input: Pick<
    GetTeamCockpitSportingDataInput,
    "teamId" | "tenantClubName" | "tenantLogoUrl"
  >,
): TeamCockpitMatch {
  return {
    eventId: item.eventId,
    startAt: item.startAt,
    side: item.side,
    status: item.status,
    lifecycle: item.lifecycle,
    opponentName: item.opponent.displayName,
    home: mapCockpitMatchSide(
      item.home,
      input.teamId,
      input.tenantClubName,
      input.tenantLogoUrl,
    ),
    away: mapCockpitMatchSide(
      item.away,
      input.teamId,
      input.tenantClubName,
      input.tenantLogoUrl,
    ),
    venueName: item.venueName,
    location: item.location,
    competitionName: resolveCockpitMatchCompetitionName(item.competition),
  };
}

function mapCockpitResult(
  item: TeamSeasonMatchItem,
  input: Pick<
    GetTeamCockpitSportingDataInput,
    "teamId" | "tenantClubName" | "tenantLogoUrl"
  >,
): TeamCockpitResult {
  const teamScore = item.side === "HOME" ? item.scoreHome : item.scoreAway;
  const opponentScore = item.side === "HOME" ? item.scoreAway : item.scoreHome;

  return {
    ...mapCockpitMatch(item, input),
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
  const identityDatabase =
    input.identityDatabase ?? (prisma as unknown as TeamCockpitIdentityDatabase);
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
    mapCockpitMatch(item, input),
  );
  const results = filterPublicTeamResults(completed, resultsLimit).map((item) =>
    mapCockpitResult(item, input),
  );

  let standings: TeamCockpitStandings | null = null;
  let standingsCompetition = null;

  if (input.sfvMapping) {
    let standingsTable = null;
    try {
      standingsTable = await resolveStandingsForMapping({
        tenantId: input.tenantId,
        teamSeasonId: input.teamSeasonId,
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
        let standingsEnrichmentByProviderTeamId = new Map<
          number,
          StandingsClubEnrichment
        >();

        try {
          standingsEnrichmentByProviderTeamId =
            await buildStandingsClubEnrichmentByProviderTeamId({
              tenantId: input.tenantId,
              rows: standingsTable.rows.map((row) => ({
                providerTeamId: row.externalTeamId,
                providerTeamName: row.teamName,
              })),
              database: identityDatabase,
            });
        } catch {
          // Identity enrichment is additive. Valid provider standings must
          // still render when the club-directory lookup is unavailable.
        }

        standings = {
          competition: standingsCompetitionDisplay,
          rows: presentStandingsRows({
            rows: standingsTable.rows,
            currentExternalTeamId: input.sfvMapping.externalTeamId,
            currentTeamShortName: input.teamShortName ?? null,
            tenantLogoUrl: input.tenantLogoUrl ?? null,
            enrichmentByProviderTeamId: standingsEnrichmentByProviderTeamId,
          }),
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

export type LoadCurrentSeasonSfvMappingInput =
  ResolveEffectiveTeamStandingsMappingInput & { tenantId: string };

export type CurrentSeasonSfvMappingData = EffectiveTeamStandingsMapping;

export function mapCurrentSeasonSfvMapping(
  mapping: Parameters<typeof resolveEffectiveTeamStandingsMapping>[0],
  input: LoadCurrentSeasonSfvMappingInput,
): CurrentSeasonSfvMappingData | null {
  return resolveEffectiveTeamStandingsMapping(mapping, input);
}

export async function loadCurrentSeasonSfvMapping(
  input: LoadCurrentSeasonSfvMappingInput,
): Promise<CurrentSeasonSfvMappingData | null> {
  return loadEffectiveTeamStandingsMapping(input);
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
    select: effectiveTeamStandingsMappingSelect,
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
