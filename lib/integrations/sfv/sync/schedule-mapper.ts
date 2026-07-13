/**
 * lib/integrations/sfv/sync/schedule-mapper.ts
 *
 * Pure mapping functions: SFV ClubScheduleEntry → canonical Event /
 * MatchExternalMapping fields.
 *
 * No side effects. No database access. No SFV client calls.
 * All functions are deterministic given the same input.
 *
 * Field ownership:
 *   SFV-owned (stored on MatchExternalMapping, updated every sync):
 *     externalMatchId, externalSeasonId, matchNumber,
 *     providerHomeTeamId, providerAwayTeamId,
 *     providerHomeTeamName, providerAwayTeamName,
 *     providerMatchState, providerMatchStateName,
 *     scoreHome, scoreAway, providerLeagueId, providerLeagueName,
 *     providerDivisionId, providerDivisionName, providerRoundNbr,
 *     providerOrganisationId, providerPlaygroundId,
 *     providerVenueName, providerSeasonName, lastSyncedAt
 *
 *   SFV-provided, written to Event (updated on sync — rescheduling):
 *     startAt (kickoff datetime)
 *
 *   SFV-provided, written to Event (updated on sync — display):
 *     opponentName, competitionLabel, location, resultLabel, status, homeAway
 *
 *   Locally managed (set only on Event creation, never overwritten by sync):
 *     pitchCode, homeDressingRoomCode, awayDressingRoomCode,
 *     websiteVisible, infoboardVisible, wochenplanVisible,
 *     trainingsplanVisible, teamPageVisible, homepageVisible,
 *     sortOrder, remarks, description, reviewStage
 *
 * Status mapping:
 *   The SFV matchState integer enum is not fully documented. We use a
 *   conservative mapping: only states verifiable from matchStateName patterns
 *   are mapped. All others fall back to SCHEDULED (upcoming) or COMPLETED
 *   (when scores are present). Raw providerMatchState is always preserved.
 *
 * Score handling:
 *   scoreTeamA corresponds to the home team (teamAId). scoreTeamB to away.
 *   The SFV API returns 0 for unplayed matches (not null). We treat score=0
 *   on an unplayed match as "no score yet" only when matchState is not
 *   indicative of a played match.
 */

import type { ClubScheduleEntry } from "../client";
import type { SfvScheduleSyncContext } from "./schedule-types";

// ── EventStatus mapping ────────────────────────────────────────────────────────

/**
 * Maps a raw SFV matchState integer and optional matchStateName to a canonical
 * EventStatus string.
 *
 * Conservative strategy:
 *   - Only map states we can confirm from textual evidence.
 *   - Return "SCHEDULED" as the safe default for unknown states.
 *   - Never infer "COMPLETED" solely from non-null scores.
 *   - "CANCELLED" and "POSTPONED" only when matchStateName provides evidence.
 *
 * Known SFV matchState patterns (observed from production SFV data):
 *   - matchStateName containing "annull" or "annulé" → CANCELLED
 *   - matchStateName containing "verschoben" or "reporté" → POSTPONED
 *   - matchStateName containing "gespielt" or "joué" or "abgeschlossen" → COMPLETED
 *   - matchStateName containing "läuft" or "en cours" or "live" → LIVE
 *
 * When matchStateName is null, we fall back to a conservative default.
 */
export function mapMatchStateToEventStatus(
  matchState: number | null | undefined,
  matchStateName: string | null | undefined,
): "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED" {
  const name = (matchStateName ?? "").toLowerCase();

  if (name.includes("annull") || name.includes("annulé") || name.includes("abgesagt")) {
    return "CANCELLED";
  }

  if (name.includes("verschob") || name.includes("reporté") || name.includes("postponed")) {
    return "POSTPONED";
  }

  if (
    name.includes("gespielt") ||
    name.includes("joué") ||
    name.includes("abgeschlossen") ||
    name.includes("beendet") ||
    name.includes("terminé") ||
    name.includes("finished") ||
    name.includes("completed")
  ) {
    return "COMPLETED";
  }

  if (name.includes("läuft") || name.includes("en cours") || name.includes("live")) {
    return "LIVE";
  }

  // Conservative default: preserve as SCHEDULED for unknown states.
  // matchState integer alone is not sufficient evidence.
  void matchState;
  return "SCHEDULED";
}

/**
 * Formats scores as a human-readable result label: "X:Y" or null.
 *
 * Returns null when:
 *   - Either score is null or undefined.
 *   - The event status does not indicate a completed or live match
 *     (avoids showing "0:0" for unplayed fixtures).
 */
export function buildResultLabel(
  scoreHome: number | null | undefined,
  scoreAway: number | null | undefined,
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED",
): string | null {
  if (scoreHome == null || scoreAway == null) return null;
  if (status === "SCHEDULED" || status === "POSTPONED" || status === "CANCELLED") return null;
  return `${scoreHome}:${scoreAway}`;
}

// ── Event creation fields ──────────────────────────────────────────────────────

/**
 * Builds the fields to set when creating a new canonical Event from an SFV
 * ClubScheduleEntry.
 *
 * Only called on first import (no prior mapping exists).
 * Locally managed fields (pitchCode, dressingRooms, visibility, etc.) are
 * set to safe defaults and are then locally managed — never overwritten.
 */
export function buildNewEventFields(
  entry: ClubScheduleEntry,
  context: SfvScheduleSyncContext,
  localTeamId: string | null,
  opponentName: string | null,
  isHome: boolean,
): {
  seasonId: string | null;
  teamId: string | null;
  type: "MATCH";
  source: "SFV";
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
  tenantId: string;
  title: string;
  startAt: Date;
  opponentName: string | null;
  competitionLabel: string | null;
  location: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  externalSource: string;
  externalSourceId: string;
  lastSyncedAt: Date;
} {
  const kickoff = new Date(entry.matchDate);
  const status = mapMatchStateToEventStatus(entry.matchState, entry.matchStateName);
  const resultLabel = buildResultLabel(entry.scoreTeamA, entry.scoreTeamB, status);

  const competition = entry.leagueName ?? entry.divisionName ?? null;
  const venue = entry.stadiumPlaygroundName ?? null;
  const homeAway = isHome ? "H" : "A";

  // Build a display title: "vs OpponentName" or competition label
  const titleParts: string[] = [];
  if (competition) titleParts.push(competition);
  const titleOpponent = opponentName ?? (isHome ? (entry.teamNameB ?? "") : (entry.teamNameA ?? ""));
  if (titleOpponent) titleParts.push(`vs ${titleOpponent}`);
  const title = titleParts.join(" — ") || `SFV Match ${entry.matchId}`;

  return {
    seasonId: null, // Resolved by caller via season lookup
    teamId: localTeamId,
    type: "MATCH",
    source: "SFV",
    status,
    tenantId: context.tenantId,
    title,
    startAt: kickoff,
    opponentName,
    competitionLabel: competition,
    location: venue,
    homeAway,
    resultLabel,
    externalSource: "SFV",
    externalSourceId: String(entry.matchId),
    lastSyncedAt: context.syncedAt,
  };
}

// ── Mapping creation/update fields ────────────────────────────────────────────

/**
 * Builds the fields to write to MatchExternalMapping from an SFV entry.
 *
 * These are SFV-owned fields. Written on both first creation and subsequent
 * syncs. They never touch locally managed Event fields.
 */
export function buildMappingFields(
  entry: ClubScheduleEntry,
  context: SfvScheduleSyncContext,
  homeTeamId: string | null,
  awayTeamId: string | null,
): {
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
} {
  return {
    provider: "SFV",
    externalMatchId: entry.matchId,
    externalSeasonId: entry.seasonId,
    matchNumber: entry.matchNumber,
    providerHomeTeamId: entry.teamAId,
    providerAwayTeamId: entry.teamBId,
    providerHomeTeamName: entry.teamNameA,
    providerAwayTeamName: entry.teamNameB,
    homeTeamId,
    awayTeamId,
    providerMatchState: entry.matchState,
    providerMatchStateName: entry.matchStateName,
    // SFV returns 0 for unplayed matches; treat as null for clarity
    scoreHome: entry.scoreTeamA,
    scoreAway: entry.scoreTeamB,
    providerLeagueId: entry.leagueId,
    providerLeagueName: entry.leagueName,
    providerDivisionId: entry.divisionId,
    providerDivisionName: entry.divisionName,
    providerRoundNbr: entry.roundNbr,
    providerOrganisationId: entry.organisationId,
    providerPlaygroundId: entry.playgroundId,
    providerVenueName: entry.stadiumPlaygroundName,
    providerSeasonName: entry.seasonName,
    lastSyncedAt: context.syncedAt,
  };
}

// ── Change detection ──────────────────────────────────────────────────────────

type ExistingMappingSnapshot = {
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
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
};

type ExistingEventSnapshot = {
  startAt: Date;
  status: string;
};

/**
 * Categorizes what changed between an existing record and incoming provider data.
 *
 * Returns change flags to populate scoresUpdated, kickoffChanges, statusChanges
 * in the sync result, and to determine if any update is needed at all.
 */
export function detectChanges(
  existingMapping: ExistingMappingSnapshot,
  existingEvent: ExistingEventSnapshot,
  incomingMapping: ReturnType<typeof buildMappingFields>,
  incomingKickoff: Date,
  incomingStatus: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED",
): {
  hasAnyChange: boolean;
  scoreChanged: boolean;
  kickoffChanged: boolean;
  statusChanged: boolean;
} {
  const scoreChanged =
    existingMapping.scoreHome !== incomingMapping.scoreHome ||
    existingMapping.scoreAway !== incomingMapping.scoreAway;

  const kickoffChanged =
    existingEvent.startAt.getTime() !== incomingKickoff.getTime();

  const statusChanged = existingEvent.status !== incomingStatus;

  const otherMappingChanged =
    existingMapping.providerMatchState !== incomingMapping.providerMatchState ||
    existingMapping.providerMatchStateName !== incomingMapping.providerMatchStateName ||
    existingMapping.providerLeagueId !== incomingMapping.providerLeagueId ||
    existingMapping.providerLeagueName !== incomingMapping.providerLeagueName ||
    existingMapping.providerDivisionId !== incomingMapping.providerDivisionId ||
    existingMapping.providerDivisionName !== incomingMapping.providerDivisionName ||
    existingMapping.providerRoundNbr !== incomingMapping.providerRoundNbr ||
    existingMapping.providerVenueName !== incomingMapping.providerVenueName ||
    existingMapping.providerHomeTeamName !== incomingMapping.providerHomeTeamName ||
    existingMapping.providerAwayTeamName !== incomingMapping.providerAwayTeamName ||
    existingMapping.homeTeamId !== incomingMapping.homeTeamId ||
    existingMapping.awayTeamId !== incomingMapping.awayTeamId;

  const hasAnyChange =
    scoreChanged || kickoffChanged || statusChanged || otherMappingChanged;

  return { hasAnyChange, scoreChanged, kickoffChanged, statusChanged };
}

// ── Team resolution helpers ───────────────────────────────────────────────────

/**
 * Given an SFV teamId, determines whether it belongs to the local tenant by
 * checking against a pre-loaded set of known local SFV team IDs.
 */
export function isLocalTeamId(
  sfvTeamId: number,
  localSfvTeamIds: ReadonlySet<number>,
): boolean {
  return localSfvTeamIds.has(sfvTeamId);
}

/**
 * Resolves opponent name from the provider entry.
 *
 * Given which SFV teamId belongs to the local club (our team), returns the
 * display name of the opposing team (the one that is NOT our team).
 */
export function resolveOpponentName(
  entry: ClubScheduleEntry,
  isOurTeamHome: boolean,
): string | null {
  return isOurTeamHome ? (entry.teamNameB ?? null) : (entry.teamNameA ?? null);
}
