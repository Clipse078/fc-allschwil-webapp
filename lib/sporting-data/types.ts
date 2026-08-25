/**
 * lib/sporting-data/types.ts
 *
 * TEAM-SFV-02B — public-safe sporting match DTOs for Matchcenter, Team Cockpit,
 * publication surfaces, website, and future mobile clients.
 */

import type { MatchcenterMatchDetail, MatchcenterMatchSummary, MatchcenterSide } from "@/lib/matchcenter/types";
import type {
  SportingLifecycleClassification,
  SportingMatchLifecycle,
  SportingReconciliationIssue,
} from "./lifecycle";

export type SportingMatchScore = {
  home: number | null;
  away: number | null;
  displayLabel: string | null;
};

export type SportingMatchOpponentView = {
  displayName: string;
  isOwnTeam: boolean;
  logoUrl: string | null;
  side: MatchcenterSide;
};

export type SportingMatchView = {
  eventId: string;
  tenantId: string;
  teamId: string | null;
  teamSeasonId: string | null;
  seasonId: string | null;
  startAt: Date;
  endAt: Date | null;
  lifecycle: SportingMatchLifecycle;
  reconciliationIssue: SportingReconciliationIssue | null;
  homeAway: string | null;
  homeTeam: MatchcenterSide;
  awayTeam: MatchcenterSide;
  opponent: SportingMatchOpponentView;
  competition: string | null;
  venue: string | null;
  score: SportingMatchScore;
  resultLabel: string | null;
  status: string;
  externalMatchId: number | null;
  /** Full Matchcenter summary retained for admin surfaces that still need it. */
  match: MatchcenterMatchSummary;
  classification: SportingLifecycleClassification;
};

export type SportingMatchListInput = {
  tenantId: string;
  teamId?: string;
  teamSeasonId?: string;
  seasonId?: string;
  seasonKey?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  now?: Date;
};

export type SportingMatchDetailInput = {
  tenantId: string;
  eventId: string;
  now?: Date;
};

export type SportingSeasonScope = {
  tenantId: string;
  seasonId: string;
  seasonKey?: string | null;
  teamId?: string | null;
  teamSeasonId?: string | null;
};
