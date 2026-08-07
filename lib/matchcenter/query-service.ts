import { resolveLongTeamName } from "@/lib/teams/team-naming";
import { resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";
import type {
  MatchcenterDetailInput,
  MatchcenterListInput,
  MatchcenterMatchDetail,
  MatchcenterMatchSummary,
  MatchcenterSide,
  MatchcenterTeamReference,
} from "./types";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const MATCHCENTER_DEFAULT_PAST_DAYS = 30;
export const MATCHCENTER_DEFAULT_FUTURE_DAYS = 180;
export const MATCHCENTER_DEFAULT_LIMIT = 250;
export const MATCHCENTER_MAX_LIMIT = 500;
export const MATCHCENTER_MAX_WINDOW_DAYS = 366;

interface MatchcenterTeamRecord {
  id: string;
  name: string;
  shortName?: string | null;
  alternativeName?: string | null;
}

/**
 * CLUB-DIRECTORY-02 — canonical Club Directory ExternalTeam record, as
 * consumed from MatchExternalMapping.homeExternalTeam / awayExternalTeam.
 * Reuses the canonical ExternalClub/ExternalTeam directory (CLUB-DIRECTORY-01)
 * rather than introducing a second opponent representation.
 */
interface MatchcenterExternalTeamRecord {
  id: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  logoUrl: string | null;
  externalClub: {
    id: string;
    logoUrl: string | null;
  };
}

interface MatchcenterMappingRecord {
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
  providerOrganisationId: number | null;
  providerPlaygroundId: number | null;
  providerVenueName: string | null;
  providerSeasonName: string | null;
  lastSyncedAt: Date;
  detailSyncedAt: Date | null;
  homeTeam: MatchcenterTeamRecord | null;
  awayTeam: MatchcenterTeamRecord | null;
  /** CLUB-DIRECTORY-02: canonical Club Directory identity for external sides. */
  homeExternalTeam?: MatchcenterExternalTeamRecord | null;
  awayExternalTeam?: MatchcenterExternalTeamRecord | null;
}

interface MatchcenterEventRecord {
  id: string;
  tenantId: string | null;
  type: string;
  source: string;
  status: string;
  reviewStage: string;
  reviewRequestedAt: Date | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  reviewNotes: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  externalSource: string | null;
  externalSourceId: string | null;
  lastSyncedAt: Date | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  intermediateResultLabel: string | null;
  meetingTime: Date | null;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  homepageVisible: boolean;
  wochenplanVisible: boolean;
  trainingsplanVisible: boolean;
  teamPageVisible: boolean;
  remarks: string | null;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  team: MatchcenterTeamRecord | null;
  matchExternalMapping: MatchcenterMappingRecord | null;
}

interface MatchcenterEventDelegate {
  findMany(args: object): Promise<MatchcenterEventRecord[]>;
  findFirst(args: object): Promise<MatchcenterEventRecord | null>;
}

export interface MatchcenterQueryDatabase {
  event: MatchcenterEventDelegate;
}

const matchcenterRelations = {
  team: {
    select: {
      id: true,
      name: true,
      shortName: true,
      alternativeName: true,
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
        },
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
        },
      },
      // CLUB-DIRECTORY-02: canonical Club Directory identity for external sides.
      homeExternalTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          logoUrl: true,
          externalClub: { select: { id: true, logoUrl: true } },
        },
      },
      awayExternalTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          alternativeName: true,
          logoUrl: true,
          externalClub: { select: { id: true, logoUrl: true } },
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

function resolveListWindow(input: MatchcenterListInput): {
  from: Date;
  to: Date;
  limit: number;
} {
  const now = input.now ?? new Date();
  const from =
    input.from ??
    new Date(
      now.getTime() -
        MATCHCENTER_DEFAULT_PAST_DAYS * DAY_IN_MILLISECONDS,
    );
  const to =
    input.to ??
    new Date(
      now.getTime() +
        MATCHCENTER_DEFAULT_FUTURE_DAYS * DAY_IN_MILLISECONDS,
    );
  const limit = input.limit ?? MATCHCENTER_DEFAULT_LIMIT;

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime())
  ) {
    throw new Error("Matchcenter date range contains an invalid date.");
  }

  if (from >= to) {
    throw new Error(
      "Matchcenter date range requires from to be earlier than to.",
    );
  }

  const windowDays =
    (to.getTime() - from.getTime()) / DAY_IN_MILLISECONDS;

  if (windowDays > MATCHCENTER_MAX_WINDOW_DAYS) {
    throw new Error(
      `Matchcenter date range cannot exceed ${MATCHCENTER_MAX_WINDOW_DAYS} days.`,
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MATCHCENTER_MAX_LIMIT
  ) {
    throw new Error(
      `Matchcenter limit must be between 1 and ${MATCHCENTER_MAX_LIMIT}.`,
    );
  }

  return {
    from,
    to,
    limit,
  };
}

function normalizeHomeAway(value: string | null): string | null {
  return value?.trim().toUpperCase() ?? null;
}

function toTeamReference(
  team: MatchcenterTeamRecord | null,
): MatchcenterTeamReference | null {
  if (team === null) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName ?? null,
    alternativeName: team.alternativeName ?? null,
  };
}

/**
 * CLUB-DIRECTORY-02 — canonical Club Directory identity for one side, as
 * consumed by createSide below. Structurally distinct from
 * MatchcenterTeamReference (tenant Team) — never conflated with it.
 */
type MatchcenterExternalTeamReference = {
  id: string;
  clubId: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  logoUrl: string | null;
};

function toExternalTeamReference(
  team: MatchcenterExternalTeamRecord | null | undefined,
): MatchcenterExternalTeamReference | null {
  if (team === null || team === undefined) {
    return null;
  }

  return {
    id: team.id,
    clubId: team.externalClub.id,
    name: team.name,
    shortName: team.shortName,
    alternativeName: team.alternativeName,
    logoUrl: resolveExternalTeamLogoUrl(team, team.externalClub),
  };
}

function createSide(input: {
  providerTeamId: number | null;
  providerTeamName: string | null;
  canonicalTeam: MatchcenterTeamReference | null;
  /**
   * CLUB-DIRECTORY-02: canonical Club Directory identity, when this side is
   * an external opponent resolved/discovered via SFV sync (or manually
   * linked). Never set alongside canonicalTeam — a side is either the
   * tenant's own team or a Club Directory opponent, never both.
   */
  canonicalExternalTeam: MatchcenterExternalTeamReference | null;
  fallbackName: string;
  isOwnTeam: boolean;
}): MatchcenterSide {
  const fallbackName = input.fallbackName.trim();

  // TEAM-IDENTITY-01 long-name resolver: TeamSeason.displayName is not in
  // scope here (no TeamSeason is loaded by this query), so the chain starts
  // at Team.name. When no tenant Team is resolved, the CLUB-DIRECTORY-02
  // canonical ExternalTeam's tenant-managed name/alternativeName is used
  // next — this is the "Matchcenter consumes canonical identity" wiring; it
  // reuses the same tested naming contract, never a second naming scheme.
  // Falls back to the manually-derived fallbackName (e.g. event.title /
  // opponentName) only when every naming source is absent — this preserves
  // behaviour for matches with no external mapping and no discovered
  // ExternalTeam at all.
  const resolvedName = resolveLongTeamName({
    teamName: input.canonicalTeam?.name ?? input.canonicalExternalTeam?.name ?? null,
    teamAlternativeName:
      input.canonicalTeam?.alternativeName ??
      input.canonicalExternalTeam?.alternativeName ??
      null,
    providerTeamName: input.providerTeamName,
  });

  return {
    providerTeamId: input.providerTeamId,
    providerTeamName: input.providerTeamName,
    canonicalTeamId: input.canonicalTeam?.id ?? null,
    canonicalTeamName: input.canonicalTeam?.name ?? null,
    canonicalTeamShortName: input.canonicalTeam?.shortName ?? null,
    canonicalTeamAlternativeName:
      input.canonicalTeam?.alternativeName ?? null,
    canonicalExternalTeamId: input.canonicalExternalTeam?.id ?? null,
    canonicalExternalClubId: input.canonicalExternalTeam?.clubId ?? null,
    canonicalExternalTeamName: input.canonicalExternalTeam?.name ?? null,
    canonicalExternalTeamShortName: input.canonicalExternalTeam?.shortName ?? null,
    canonicalExternalTeamAlternativeName:
      input.canonicalExternalTeam?.alternativeName ?? null,
    externalLogoUrl: input.canonicalExternalTeam?.logoUrl ?? null,
    displayName: resolvedName || fallbackName || "Unknown team",
    resolution:
      input.canonicalTeam === null
        ? "UNRESOLVED"
        : "RESOLVED",
    isOwnTeam: input.isOwnTeam,
  };
}

function resolveSides(event: MatchcenterEventRecord): {
  home: MatchcenterSide;
  away: MatchcenterSide;
} {
  const mapping = event.matchExternalMapping;

  if (mapping !== null) {
    const homeTeam = toTeamReference(mapping.homeTeam);
    const awayTeam = toTeamReference(mapping.awayTeam);
    const homeExternalTeam = toExternalTeamReference(mapping.homeExternalTeam);
    const awayExternalTeam = toExternalTeamReference(mapping.awayExternalTeam);

    return {
      home: createSide({
        providerTeamId: mapping.providerHomeTeamId,
        providerTeamName: mapping.providerHomeTeamName,
        canonicalTeam: homeTeam,
        canonicalExternalTeam: homeExternalTeam,
        fallbackName:
          normalizeHomeAway(event.homeAway) === "AWAY"
            ? event.opponentName ?? "Home team"
            : event.team?.name ?? event.title,
        isOwnTeam: homeTeam !== null,
      }),
      away: createSide({
        providerTeamId: mapping.providerAwayTeamId,
        providerTeamName: mapping.providerAwayTeamName,
        canonicalTeam: awayTeam,
        canonicalExternalTeam: awayExternalTeam,
        fallbackName:
          normalizeHomeAway(event.homeAway) === "HOME"
            ? event.opponentName ?? "Away team"
            : event.team?.name ?? event.title,
        isOwnTeam: awayTeam !== null,
      }),
    };
  }

  const eventTeam = toTeamReference(event.team);
  const homeAway = normalizeHomeAway(event.homeAway);
  const ownTeamIsAway = homeAway === "AWAY";

  return {
    home: createSide({
      providerTeamId: null,
      providerTeamName: null,
      canonicalTeam: ownTeamIsAway ? null : eventTeam,
      canonicalExternalTeam: null,
      fallbackName: ownTeamIsAway
        ? event.opponentName ?? "Home team"
        : event.team?.name ?? event.title,
      isOwnTeam: !ownTeamIsAway && eventTeam !== null,
    }),
    away: createSide({
      providerTeamId: null,
      providerTeamName: null,
      canonicalTeam: ownTeamIsAway ? eventTeam : null,
      canonicalExternalTeam: null,
      fallbackName: ownTeamIsAway
        ? event.team?.name ?? event.title
        : event.opponentName ?? "Away team",
      isOwnTeam: ownTeamIsAway && eventTeam !== null,
    }),
  };
}

function toSummary(
  event: MatchcenterEventRecord,
): MatchcenterMatchSummary {
  if (event.tenantId === null) {
    throw new Error(
      `Matchcenter event ${event.id} has no tenantId.`,
    );
  }

  const mapping = event.matchExternalMapping;
  const sides = resolveSides(event);

  return {
    id: event.id,
    tenantId: event.tenantId,
    type: "MATCH",
    title: event.title,
    description: event.description,
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
    competitionLabel: event.competitionLabel,
    homeAway: event.homeAway,
    resultLabel: event.resultLabel,
    intermediateResultLabel:
      event.intermediateResultLabel,
    scoreHome: mapping?.scoreHome ?? null,
    scoreAway: mapping?.scoreAway ?? null,
    home: sides.home,
    away: sides.away,
    source: {
      eventSource: event.source,
      externalSource: event.externalSource,
      externalSourceId: event.externalSourceId,
      provider: mapping?.provider ?? null,
      externalMatchId:
        mapping?.externalMatchId ?? null,
      externalSeasonId:
        mapping?.externalSeasonId ?? null,
      matchNumber: mapping?.matchNumber ?? null,
    },
    synchronization: {
      eventLastSyncedAt: event.lastSyncedAt,
      mappingLastSyncedAt:
        mapping?.lastSyncedAt ?? null,
      detailSyncedAt:
        mapping?.detailSyncedAt ?? null,
      providerMatchState:
        mapping?.providerMatchState ?? null,
      providerMatchStateName:
        mapping?.providerMatchStateName ?? null,
    },
    operational: {
      pitchCode: event.pitchCode,
      homeDressingRoomCode:
        event.homeDressingRoomCode,
      awayDressingRoomCode:
        event.awayDressingRoomCode,
      meetingTime: event.meetingTime,
      remarks: event.remarks,
    },
    visibility: {
      websiteVisible: event.websiteVisible,
      infoboardVisible: event.infoboardVisible,
      homepageVisible: event.homepageVisible,
      wochenplanVisible: event.wochenplanVisible,
      trainingsplanVisible:
        event.trainingsplanVisible,
      teamPageVisible: event.teamPageVisible,
    },
    reviewStage: event.reviewStage,
    publishedAt: event.publishedAt,
  };
}

function toDetail(
  event: MatchcenterEventRecord,
): MatchcenterMatchDetail {
  const summary = toSummary(event);
  const mapping = event.matchExternalMapping;

  return {
    ...summary,
    teamId: event.team?.id ?? null,
    organizerName: event.organizerName,
    reviewRequestedAt: event.reviewRequestedAt,
    reviewedAt: event.reviewedAt,
    reviewNotes: event.reviewNotes,
    providerLeagueId:
      mapping?.providerLeagueId ?? null,
    providerLeagueName:
      mapping?.providerLeagueName ?? null,
    providerDivisionId:
      mapping?.providerDivisionId ?? null,
    providerDivisionName:
      mapping?.providerDivisionName ?? null,
    providerRoundNumber:
      mapping?.providerRoundNbr ?? null,
    providerOrganisationId:
      mapping?.providerOrganisationId ?? null,
    providerPlaygroundId:
      mapping?.providerPlaygroundId ?? null,
    providerVenueName:
      mapping?.providerVenueName ?? null,
    providerSeasonName:
      mapping?.providerSeasonName ?? null,
  };
}

export async function listMatchcenterMatches(
  database: MatchcenterQueryDatabase,
  input: MatchcenterListInput,
): Promise<MatchcenterMatchSummary[]> {
  const tenantId = requireIdentifier(
    input.tenantId,
    "tenantId",
  );
  const window = resolveListWindow(input);

  const events = await database.event.findMany({
    where: {
      tenantId,
      type: "MATCH",
      startAt: {
        gte: window.from,
        lte: window.to,
      },
    },
    include: matchcenterRelations,
    orderBy: [
      {
        startAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    take: window.limit,
  });

  return events.map(toSummary);
}

export async function getMatchcenterMatchDetail(
  database: MatchcenterQueryDatabase,
  input: MatchcenterDetailInput,
): Promise<MatchcenterMatchDetail | null> {
  const tenantId = requireIdentifier(
    input.tenantId,
    "tenantId",
  );
  const eventId = requireIdentifier(
    input.eventId,
    "eventId",
  );

  const event = await database.event.findFirst({
    where: {
      id: eventId,
      tenantId,
      type: "MATCH",
    },
    include: matchcenterRelations,
  });

  return event === null ? null : toDetail(event);
}
