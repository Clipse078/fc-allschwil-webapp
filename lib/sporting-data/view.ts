/**
 * lib/sporting-data/view.ts
 *
 * TEAM-SFV-02B — builds public-safe SportingMatchView DTOs from Matchcenter
 * summaries without duplicating side/opponent identity resolution.
 */

import type { MatchcenterMatchDetail, MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import {
  classifySportingMatchLifecycle,
  type SportingLifecycleClassification,
} from "./lifecycle";
import { resolveSportingResultDisplay } from "./resolve-sporting-result-display";
import type { SportingMatchOpponentView, SportingMatchView } from "./types";

function normalizedHomeAway(value: string | null | undefined): "HOME" | "AWAY" | null {
  const normalized = value?.trim().toUpperCase() ?? null;
  return normalized === "HOME" || normalized === "AWAY" ? normalized : null;
}

function resolveOpponentView(
  match: MatchcenterMatchSummary,
  tenantLogoUrl?: string | null,
): SportingMatchOpponentView {
  const homeAway = normalizedHomeAway(match.homeAway);
  const opponentSide =
    homeAway === "AWAY" ? match.home : homeAway === "HOME" ? match.away : match.away;

  return {
    displayName: resolveMatchcenterCompactSideName(opponentSide),
    isOwnTeam: opponentSide.isOwnTeam,
    logoUrl: resolveClubIdentityLogoUrl(opponentSide, tenantLogoUrl ?? null),
    side: opponentSide,
  };
}

export function buildSportingMatchView(
  match: MatchcenterMatchSummary,
  options: {
    now?: Date;
    teamSeasonId?: string | null;
    tenantLogoUrl?: string | null;
  } = {},
): SportingMatchView {
  const classification: SportingLifecycleClassification =
    classifySportingMatchLifecycle({
      status: match.status,
      startAt: match.startAt,
      providerMatchStateName:
        match.synchronization.providerMatchStateName,
      now: options.now,
    });

  const displayLabel = resolveSportingResultDisplay({
    lifecycle: classification.lifecycle,
    resultLabel: match.resultLabel,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
  });

  return {
    eventId: match.id,
    tenantId: match.tenantId,
    teamId: match.teamId,
    teamSeasonId: options.teamSeasonId ?? null,
    seasonId: match.seasonId,
    startAt: match.startAt,
    endAt: match.endAt,
    lifecycle: classification.lifecycle,
    reconciliationIssue: classification.reconciliationIssue,
    homeAway: match.homeAway,
    homeTeam: match.home,
    awayTeam: match.away,
    opponent: resolveOpponentView(match, options.tenantLogoUrl),
    competition: match.competitionLabel,
    venue: match.location,
    score: {
      home: match.scoreHome,
      away: match.scoreAway,
      displayLabel,
    },
    resultLabel: displayLabel,
    status: match.status,
    externalMatchId: match.source.externalMatchId,
    match,
    classification,
  };
}

export function buildSportingMatchDetailView(
  match: MatchcenterMatchDetail,
  options: {
    now?: Date;
    teamSeasonId?: string | null;
    tenantLogoUrl?: string | null;
  } = {},
): SportingMatchView {
  return buildSportingMatchView(match, options);
}
