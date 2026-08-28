import { resolveLongTeamName } from "@/lib/teams/team-naming";
import {
  getMatchcenterLifecycleClassification,
  getMatchcenterLifecycleStage,
  getMatchcenterResultLabel,
} from "@/lib/matchcenter/match-lifecycle";
import {
  isSportingMatchPastKickoff,
  type SportingMatchLifecycle,
} from "@/lib/sporting-data/lifecycle";
import { resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";

export type TeamMatchPerspectiveSide = "HOME" | "AWAY";

export type TeamSeasonMatchLifecycleStage = "UPCOMING" | "COMPLETED";

export interface TeamMatchSideIdentity {
  canonicalTeamId: string | null;
  canonicalExternalTeamId: string | null;
  displayName: string;
  clubName: string | null;
  externalLogoUrl: string | null;
  providerTeamId: number | null;
  providerTeamName: string | null;
}

export interface TeamSeasonMatchOpponent {
  displayName: string;
  canonicalTeamId: string | null;
  canonicalExternalTeamId: string | null;
  providerTeamId: number | null;
  providerTeamName: string | null;
}

export interface TeamSeasonMatchCompetitionContext {
  eventCompetitionLabel: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerDivisionId: number | null;
  providerDivisionName: string | null;
  providerRoundNumber: number | null;
  canonicalCompetitionId: string | null;
  canonicalCompetitionName: string | null;
  canonicalCompetitionShortName: string | null;
}

export interface TeamSeasonMatchProviderIdentity {
  provider: string | null;
  externalMatchId: number | null;
  externalSeasonId: number | null;
  matchNumber: number | null;
  providerMatchState: number | null;
  providerMatchStateName: string | null;
}

export interface TeamSeasonMatchItem {
  eventId: string;
  tenantId: string;
  teamSeasonId: string;
  seasonId: string;
  side: TeamMatchPerspectiveSide;
  startAt: Date;
  endAt: Date | null;
  status: string;
  lifecycle: SportingMatchLifecycle;
  lifecycleStage: TeamSeasonMatchLifecycleStage;
  home: TeamMatchSideIdentity;
  away: TeamMatchSideIdentity;
  opponent: TeamSeasonMatchOpponent;
  competition: TeamSeasonMatchCompetitionContext;
  location: string | null;
  venueName: string | null;
  resultLabel: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  intermediateResultLabel: string | null;
  provider: TeamSeasonMatchProviderIdentity;
}

export interface ListTeamSeasonMatchesResult {
  upcoming: TeamSeasonMatchItem[];
  completed: TeamSeasonMatchItem[];
}

export interface ListTeamSeasonMatchesInput {
  tenantId: string;
  teamSeasonId: string;
  now?: Date;
  /**
   * When true, restricts the canonical event query to websiteVisible=true.
   * Used by the public team-page feed. Does not require teamPageVisible=true
   * because SFV-imported fixtures default teamPageVisible=false with no active
   * publishing workflow.
   */
  websiteVisibleOnly?: boolean;
}

interface TeamMatchTeamRecord {
  id: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  tenantId: string | null;
}

interface TeamMatchExternalTeamRecord {
  id: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  logoUrl: string | null;
  externalClub: {
    name: string;
    logoUrl: string | null;
  };
}

interface TeamMatchMappingRecord {
  provider: string;
  externalMatchId: number;
  externalSeasonId: number;
  matchNumber: number | null;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  providerMatchState: number | null;
  providerMatchStateName: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerDivisionId: number | null;
  providerDivisionName: string | null;
  providerRoundNbr: number | null;
  providerVenueName: string | null;
  homeTeam: TeamMatchTeamRecord | null;
  awayTeam: TeamMatchTeamRecord | null;
  homeExternalTeam: TeamMatchExternalTeamRecord | null;
  awayExternalTeam: TeamMatchExternalTeamRecord | null;
}

interface TeamMatchEventRecord {
  id: string;
  tenantId: string | null;
  seasonId: string | null;
  teamId: string | null;
  type: string;
  status: string;
  title: string;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  opponentName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  intermediateResultLabel: string | null;
  team: TeamMatchTeamRecord | null;
  matchExternalMapping: TeamMatchMappingRecord | null;
}

interface TeamSeasonCompetitionRecord {
  isPrimary: boolean;
  displayOrder: number;
  competition: {
    id: string;
    officialName: string;
    shortName: string | null;
    groupName: string | null;
  };
}

interface TeamSeasonContextRecord {
  id: string;
  teamId: string;
  seasonId: string;
  displayName: string;
  team: TeamMatchTeamRecord;
  season: {
    id: string;
    key: string;
    name: string;
  };
  competitions: TeamSeasonCompetitionRecord[];
}

interface TeamSeasonDelegate {
  findFirst(args: object): Promise<TeamSeasonContextRecord | null>;
}

interface TeamMatchEventDelegate {
  findMany(args: object): Promise<TeamMatchEventRecord[]>;
}

export interface TeamMatchQueryDatabase {
  teamSeason: TeamSeasonDelegate;
  event: TeamMatchEventDelegate;
}

const teamMatchRelations = {
  team: {
    select: {
      id: true,
      name: true,
      shortName: true,
      alternativeName: true,
      tenantId: true,
    },
  },
  matchExternalMapping: {
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          tenantId: true,
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          tenantId: true,
        },
      },
      homeExternalTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          logoUrl: true,
          externalClub: {
            select: {
              name: true,
              logoUrl: true,
            },
          },
        },
      },
      awayExternalTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          logoUrl: true,
          externalClub: {
            select: {
              name: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  },
} as const;

const teamSeasonSelect = {
  id: true,
  teamId: true,
  seasonId: true,
  displayName: true,
  team: {
    select: {
      id: true,
      name: true,
      shortName: true,
      alternativeName: true,
      tenantId: true,
    },
  },
  season: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
  competitions: {
    orderBy: [
      { isPrimary: "desc" as const },
      { displayOrder: "asc" as const },
    ],
    select: {
      isPrimary: true,
      displayOrder: true,
      competition: {
        select: {
          id: true,
          officialName: true,
          shortName: true,
          groupName: true,
        },
      },
    },
  },
} as const;

function requireIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeHomeAway(value: string | null): string | null {
  return value?.trim().toUpperCase() ?? null;
}

function toSideIdentity(input: {
  providerTeamId: number | null;
  providerTeamName: string | null;
  canonicalTeam: TeamMatchTeamRecord | null;
  canonicalExternalTeam: TeamMatchExternalTeamRecord | null;
  fallbackName: string;
}): TeamMatchSideIdentity {
  const resolvedName = resolveLongTeamName({
    teamName: input.canonicalTeam?.name ?? input.canonicalExternalTeam?.name ?? null,
    teamAlternativeName:
      input.canonicalTeam?.alternativeName ??
      input.canonicalExternalTeam?.alternativeName ??
      null,
    providerTeamName: input.providerTeamName,
  });

  return {
    canonicalTeamId: input.canonicalTeam?.id ?? null,
    canonicalExternalTeamId: input.canonicalExternalTeam?.id ?? null,
    displayName: resolvedName || input.fallbackName.trim() || "Unknown team",
    clubName: input.canonicalExternalTeam?.externalClub?.name ?? null,
    externalLogoUrl: input.canonicalExternalTeam
      ? resolveExternalTeamLogoUrl(
          input.canonicalExternalTeam,
          input.canonicalExternalTeam.externalClub ?? { logoUrl: null },
        )
      : null,
    providerTeamId: input.providerTeamId,
    providerTeamName: input.providerTeamName,
  };
}

function resolveSides(event: TeamMatchEventRecord): {
  home: TeamMatchSideIdentity;
  away: TeamMatchSideIdentity;
} {
  const mapping = event.matchExternalMapping;

  if (mapping !== null) {
    const homeAway = normalizeHomeAway(event.homeAway);

    return {
      home: toSideIdentity({
        providerTeamId: mapping.providerHomeTeamId,
        providerTeamName: mapping.providerHomeTeamName,
        canonicalTeam: mapping.homeTeam,
        canonicalExternalTeam: mapping.homeExternalTeam,
        fallbackName:
          homeAway === "AWAY"
            ? event.opponentName ?? "Home team"
            : event.team?.name ?? event.title,
      }),
      away: toSideIdentity({
        providerTeamId: mapping.providerAwayTeamId,
        providerTeamName: mapping.providerAwayTeamName,
        canonicalTeam: mapping.awayTeam,
        canonicalExternalTeam: mapping.awayExternalTeam,
        fallbackName:
          homeAway === "HOME"
            ? event.opponentName ?? "Away team"
            : event.team?.name ?? event.title,
      }),
    };
  }

  const homeAway = normalizeHomeAway(event.homeAway);
  const ownTeamIsAway = homeAway === "AWAY";

  return {
    home: toSideIdentity({
      providerTeamId: null,
      providerTeamName: null,
      canonicalTeam: ownTeamIsAway ? null : event.team,
      canonicalExternalTeam: null,
      fallbackName: ownTeamIsAway
        ? event.opponentName ?? "Home team"
        : event.team?.name ?? event.title,
    }),
    away: toSideIdentity({
      providerTeamId: null,
      providerTeamName: null,
      canonicalTeam: ownTeamIsAway ? event.team : null,
      canonicalExternalTeam: null,
      fallbackName: ownTeamIsAway
        ? event.team?.name ?? event.title
        : event.opponentName ?? "Away team",
    }),
  };
}

export function resolveTeamMatchPerspectiveSide(
  event: Pick<TeamMatchEventRecord, "teamId" | "homeAway">,
  mapping: Pick<TeamMatchMappingRecord, "homeTeamId" | "awayTeamId"> | null,
  requestedTeamId: string,
): TeamMatchPerspectiveSide | null {
  if (mapping !== null) {
    if (mapping.homeTeamId === requestedTeamId) {
      return "HOME";
    }

    if (mapping.awayTeamId === requestedTeamId) {
      return "AWAY";
    }

    return null;
  }

  if (event.teamId !== requestedTeamId) {
    return null;
  }

  return normalizeHomeAway(event.homeAway) === "AWAY" ? "AWAY" : "HOME";
}

function toOpponent(
  side: TeamMatchPerspectiveSide,
  home: TeamMatchSideIdentity,
  away: TeamMatchSideIdentity,
): TeamSeasonMatchOpponent {
  const opponentSide = side === "HOME" ? away : home;

  return {
    displayName: opponentSide.displayName,
    canonicalTeamId: opponentSide.canonicalTeamId,
    canonicalExternalTeamId: opponentSide.canonicalExternalTeamId,
    providerTeamId: opponentSide.providerTeamId,
    providerTeamName: opponentSide.providerTeamName,
  };
}

function resolveCanonicalCompetition(
  competitions: TeamSeasonCompetitionRecord[],
): TeamSeasonCompetitionRecord | null {
  if (competitions.length === 0) {
    return null;
  }

  return competitions.find((entry) => entry.isPrimary) ?? competitions[0] ?? null;
}

function toCompetitionContext(
  event: TeamMatchEventRecord,
  teamSeason: TeamSeasonContextRecord,
): TeamSeasonMatchCompetitionContext {
  const canonicalCompetition = resolveCanonicalCompetition(teamSeason.competitions);
  const mapping = event.matchExternalMapping;

  return {
    eventCompetitionLabel: event.competitionLabel,
    providerLeagueId: mapping?.providerLeagueId ?? null,
    providerLeagueName: mapping?.providerLeagueName ?? null,
    providerDivisionId: mapping?.providerDivisionId ?? null,
    providerDivisionName: mapping?.providerDivisionName ?? null,
    providerRoundNumber: mapping?.providerRoundNbr ?? null,
    canonicalCompetitionId: canonicalCompetition?.competition.id ?? null,
    canonicalCompetitionName: canonicalCompetition?.competition.officialName ?? null,
    canonicalCompetitionShortName: canonicalCompetition?.competition.shortName ?? null,
  };
}

function toTeamSeasonMatchItem(
  event: TeamMatchEventRecord,
  teamSeason: TeamSeasonContextRecord,
  side: TeamMatchPerspectiveSide,
  now: Date,
): TeamSeasonMatchItem {
  if (event.tenantId === null) {
    throw new Error(`Team match event ${event.id} has no tenantId.`);
  }

  if (event.seasonId === null) {
    throw new Error(`Team match event ${event.id} has no seasonId.`);
  }

  const mapping = event.matchExternalMapping;
  const sides = resolveSides(event);
  const lifecycleClassification = getMatchcenterLifecycleClassification(
    {
      status: event.status,
      startAt: event.startAt,
      synchronization: {
        providerMatchStateName: mapping?.providerMatchStateName ?? null,
      },
    },
    now,
  );
  const lifecycleStage = getMatchcenterLifecycleStage(
    {
      status: event.status,
      startAt: event.startAt,
      synchronization: {
        providerMatchStateName: mapping?.providerMatchStateName ?? null,
      },
    },
    now,
  );
  const resultLabel = getMatchcenterResultLabel(
    {
      status: event.status,
      startAt: event.startAt,
      scoreHome: mapping?.scoreHome ?? null,
      scoreAway: mapping?.scoreAway ?? null,
      resultLabel: event.resultLabel,
      synchronization: {
        providerMatchStateName: mapping?.providerMatchStateName ?? null,
      },
    },
    now,
  );

  return {
    eventId: event.id,
    tenantId: event.tenantId,
    teamSeasonId: teamSeason.id,
    seasonId: event.seasonId,
    side,
    startAt: event.startAt,
    endAt: event.endAt,
    status: event.status,
    lifecycle: lifecycleClassification.lifecycle,
    lifecycleStage,
    home: sides.home,
    away: sides.away,
    opponent: toOpponent(side, sides.home, sides.away),
    competition: toCompetitionContext(event, teamSeason),
    location: event.location,
    venueName: mapping?.providerVenueName ?? event.location,
    resultLabel,
    scoreHome: mapping?.scoreHome ?? null,
    scoreAway: mapping?.scoreAway ?? null,
    intermediateResultLabel: event.intermediateResultLabel,
    provider: {
      provider: mapping?.provider ?? null,
      externalMatchId: mapping?.externalMatchId ?? null,
      externalSeasonId: mapping?.externalSeasonId ?? null,
      matchNumber: mapping?.matchNumber ?? null,
      providerMatchState: mapping?.providerMatchState ?? null,
      providerMatchStateName: mapping?.providerMatchStateName ?? null,
    },
  };
}

function compareAscending(left: TeamSeasonMatchItem, right: TeamSeasonMatchItem): number {
  const startDiff = left.startAt.getTime() - right.startAt.getTime();

  if (startDiff !== 0) {
    return startDiff;
  }

  return left.eventId.localeCompare(right.eventId);
}

function compareDescending(left: TeamSeasonMatchItem, right: TeamSeasonMatchItem): number {
  return compareAscending(right, left);
}

/**
 * Team-page "Nächste Spiele" semantics on top of canonical lifecycle classification.
 * Excludes stale historical non-completed fixtures while preserving LIVE,
 * POSTPONED, and CANCELLED continuity.
 */
function isTeamSeasonUpcomingItem(item: TeamSeasonMatchItem, now: Date): boolean {
  if (
    item.lifecycle === "LIVE" ||
    item.lifecycle === "POSTPONED" ||
    item.lifecycle === "CANCELLED"
  ) {
    return true;
  }

  if (item.lifecycle === "NEEDS_RECONCILIATION") {
    return false;
  }

  if (item.lifecycle === "UPCOMING") {
    return !isSportingMatchPastKickoff(item.startAt, now);
  }

  return false;
}

export async function listTeamSeasonMatches(
  database: TeamMatchQueryDatabase,
  input: ListTeamSeasonMatchesInput,
): Promise<ListTeamSeasonMatchesResult> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const teamSeasonId = requireIdentifier(input.teamSeasonId, "teamSeasonId");
  const now = input.now ?? new Date();

  const teamSeason = await database.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      team: {
        tenantId,
      },
    },
    select: teamSeasonSelect,
  });

  if (teamSeason === null) {
    throw new Error("TeamSeason not found for tenant.");
  }

  const events = await database.event.findMany({
    where: {
      tenantId,
      type: "MATCH",
      seasonId: teamSeason.seasonId,
      ...(input.websiteVisibleOnly === true ? { websiteVisible: true } : {}),
      OR: [
        {
          matchExternalMapping: {
            homeTeamId: teamSeason.teamId,
          },
        },
        {
          matchExternalMapping: {
            awayTeamId: teamSeason.teamId,
          },
        },
        {
          teamId: teamSeason.teamId,
          matchExternalMapping: null,
        },
      ],
    },
    include: teamMatchRelations,
    orderBy: [
      { startAt: "asc" },
      { id: "asc" },
    ],
  });

  const upcoming: TeamSeasonMatchItem[] = [];
  const completed: TeamSeasonMatchItem[] = [];

  for (const event of events) {
    const side = resolveTeamMatchPerspectiveSide(
      event,
      event.matchExternalMapping,
      teamSeason.teamId,
    );

    if (side === null) {
      continue;
    }

    const item = toTeamSeasonMatchItem(event, teamSeason, side, now);

    if (item.lifecycleStage === "COMPLETED") {
      completed.push(item);
    } else if (isTeamSeasonUpcomingItem(item, now)) {
      upcoming.push(item);
    }
  }

  upcoming.sort(compareAscending);
  completed.sort(compareDescending);

  return {
    upcoming,
    completed,
  };
}
