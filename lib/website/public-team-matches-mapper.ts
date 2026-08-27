/**
 * lib/website/public-team-matches-mapper.ts
 *
 * Maps canonical team-season match rows to public website "Nächste Spiele" DTOs.
 *
 * Publication contract:
 * - Callers must query canonical matches with websiteVisible=true.
 * - teamPageVisible is intentionally NOT required: SFV-imported fixtures default
 *   teamPageVisible=false and have no active publishing workflow yet.
 * - This mapper layers public-upcoming semantics on top of listTeamSeasonMatches
 *   without mutating the shared team-match-query lifecycle buckets.
 */

import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { isSportingMatchPastKickoff } from "@/lib/sporting-data/lifecycle";
import type {
  TeamMatchSideIdentity,
  TeamSeasonMatchCompetitionContext,
  TeamSeasonMatchItem,
} from "@/lib/teams/team-match-query-service";
import type {
  PublicTeamMatch,
  PublicTeamMatchCompetition,
  PublicTeamMatchOpponent,
  PublicTeamMatchSide,
  PublicTeamMatchVenue,
} from "@/lib/website/types";

export const PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT = 5;

export type PublicTeamMatchTeamRecord = {
  id: string;
  shortName: string | null;
};

export type PublicTeamMatchExternalTeamRecord = {
  id: string;
  shortName: string | null;
  logoUrl: string | null;
  clubName: string;
};

export type PublicTeamMatchIdentityContext = {
  currentTeamId: string;
  tenantLogoUrl: string | null;
  tenantClubName: string;
  teamById: ReadonlyMap<string, PublicTeamMatchTeamRecord>;
  externalTeamById: ReadonlyMap<string, PublicTeamMatchExternalTeamRecord>;
};

function meaningful(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Public team-page upcoming filter layered over canonical lifecycle buckets.
 * Excludes cancelled fixtures from the default nextMatches collection.
 */
export function isPublicTeamNextMatch(
  item: TeamSeasonMatchItem,
  now: Date,
): boolean {
  if (item.lifecycle === "CANCELLED") {
    return false;
  }

  if (item.lifecycle === "NEEDS_RECONCILIATION") {
    return false;
  }

  if (item.lifecycleStage === "COMPLETED") {
    return false;
  }

  const normalizedStatus = item.status.trim().toUpperCase();

  if (normalizedStatus === "DRAFT" || normalizedStatus === "ARCHIVED") {
    return false;
  }

  if (item.lifecycle === "LIVE" || item.lifecycle === "POSTPONED") {
    return true;
  }

  if (item.lifecycle === "UPCOMING") {
    return !isSportingMatchPastKickoff(item.startAt, now);
  }

  return false;
}

export function filterPublicTeamNextMatches(
  items: TeamSeasonMatchItem[],
  now: Date,
  limit = PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT,
): TeamSeasonMatchItem[] {
  const sorted = [...items].sort((left, right) => {
    const startDiff = left.startAt.getTime() - right.startAt.getTime();

    if (startDiff !== 0) {
      return startDiff;
    }

    return left.eventId.localeCompare(right.eventId);
  });
  const filtered: TeamSeasonMatchItem[] = [];

  for (const item of sorted) {
    if (!isPublicTeamNextMatch(item, now)) {
      continue;
    }

    filtered.push(item);

    if (filtered.length >= limit) {
      break;
    }
  }

  return filtered;
}

function resolveCompetitionLabel(
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

function resolveVenue(item: TeamSeasonMatchItem): PublicTeamMatchVenue {
  const venueName = meaningful(item.venueName);
  const location = meaningful(item.location);

  return {
    name: venueName,
    address: location,
  };
}

function resolveSideLogo(
  side: TeamMatchSideIdentity,
  context: PublicTeamMatchIdentityContext,
): string | null {
  if (side.canonicalTeamId) {
    return resolveClubIdentityLogoUrl(
      { isOwnTeam: true, externalLogoUrl: null },
      context.tenantLogoUrl,
    );
  }

  if (side.canonicalExternalTeamId) {
    const externalTeam = context.externalTeamById.get(side.canonicalExternalTeamId);
    return resolveClubIdentityLogoUrl(
      { isOwnTeam: false, externalLogoUrl: externalTeam?.logoUrl ?? null },
      context.tenantLogoUrl,
    );
  }

  return null;
}

function resolveSideClubName(
  side: TeamMatchSideIdentity,
  context: PublicTeamMatchIdentityContext,
): string | null {
  if (side.canonicalTeamId) {
    return context.tenantClubName;
  }

  if (side.canonicalExternalTeamId) {
    return context.externalTeamById.get(side.canonicalExternalTeamId)?.clubName ?? null;
  }

  return null;
}

function resolveSideShortName(
  side: TeamMatchSideIdentity,
  context: PublicTeamMatchIdentityContext,
): string | null {
  if (side.canonicalTeamId) {
    return context.teamById.get(side.canonicalTeamId)?.shortName ?? null;
  }

  if (side.canonicalExternalTeamId) {
    return context.externalTeamById.get(side.canonicalExternalTeamId)?.shortName ?? null;
  }

  return null;
}

function mapPublicTeamMatchSide(
  side: TeamMatchSideIdentity,
  context: PublicTeamMatchIdentityContext,
): PublicTeamMatchSide {
  return {
    teamId: side.canonicalTeamId,
    name: side.displayName,
    shortName: resolveSideShortName(side, context),
    clubName: resolveSideClubName(side, context),
    logoUrl: resolveSideLogo(side, context),
  };
}

function mapPublicTeamMatchOpponent(
  item: TeamSeasonMatchItem,
  context: PublicTeamMatchIdentityContext,
): PublicTeamMatchOpponent {
  const opponentSide = item.side === "HOME" ? item.away : item.home;

  return {
    name: item.opponent.displayName,
    shortName: resolveSideShortName(opponentSide, context),
    clubName: resolveSideClubName(opponentSide, context),
    logoUrl: resolveSideLogo(opponentSide, context),
  };
}

export function mapPublicTeamMatch(
  item: TeamSeasonMatchItem,
  context: PublicTeamMatchIdentityContext,
): PublicTeamMatch {
  const isHomeTeam = item.side === "HOME";
  const competition: PublicTeamMatchCompetition = {
    name: resolveCompetitionLabel(item.competition),
  };

  return {
    id: item.eventId,
    startAt: item.startAt,
    status: item.status,
    home: mapPublicTeamMatchSide(item.home, context),
    away: mapPublicTeamMatchSide(item.away, context),
    isHomeTeam,
    isAwayTeam: !isHomeTeam,
    opponent: mapPublicTeamMatchOpponent(item, context),
    venue: resolveVenue(item),
    competition,
  };
}

export function mapPublicTeamMatches(
  items: TeamSeasonMatchItem[],
  context: PublicTeamMatchIdentityContext,
  now: Date,
  limit = PUBLIC_TEAM_NEXT_MATCHES_DEFAULT_LIMIT,
): PublicTeamMatch[] {
  return filterPublicTeamNextMatches(items, now, limit).map((item) =>
    mapPublicTeamMatch(item, context),
  );
}
