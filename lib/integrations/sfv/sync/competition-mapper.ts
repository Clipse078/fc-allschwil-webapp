/**
 * lib/integrations/sfv/sync/competition-mapper.ts
 *
 * Pure mapping functions: SFV TeamDetail[] → ExtractedSfvCompetition[].
 *
 * No side effects. No database access. No SFV client calls.
 * All functions are deterministic given the same input.
 *
 * Extraction strategy:
 *   SFV exposes competition data as part of TeamDetail (team list). Each team
 *   references a league via teamLeagueId / teamLeagueName and optionally a
 *   division via teamDivisionName. We deduplicate by teamLeagueId + seasonId
 *   to produce one Competition row per league per season.
 */

import type { TeamDetail } from "../client";
import type { ExtractedSfvCompetition } from "./competition-types";
import type { CompetitionGender } from "@prisma/client";

// ── Extraction ─────────────────────────────────────────────────────────────────

/**
 * Extracts unique competitions from a SFV team list response.
 *
 * Deduplication key: teamLeagueId. Multiple teams may share a league
 * (e.g. home + away in a league). Only one Competition row per league per
 * season is produced.
 *
 * Teams without a valid teamLeagueId (0 or absent) are skipped.
 */
export function extractCompetitionsFromTeamList(
  teams: TeamDetail[],
  seasonId: number,
): ExtractedSfvCompetition[] {
  const seen = new Map<number, ExtractedSfvCompetition>();

  for (const team of teams) {
    const leagueId = team.teamLeagueId;

    if (!leagueId || leagueId === 0) {
      continue;
    }

    if (seen.has(leagueId)) {
      continue;
    }

    const officialName =
      team.teamLeagueName?.trim() ?? `SFV League ${leagueId}`;

    seen.set(leagueId, {
      externalCompetitionId: leagueId,
      externalSeasonId: seasonId,
      officialName,
      groupName: team.teamDivisionName?.trim() ?? null,
    });
  }

  return Array.from(seen.values());
}

// ── Gender inference ───────────────────────────────────────────────────────────

/**
 * Infers CompetitionGender from a competition name.
 *
 * SFV does not provide a structured gender field. This is best-effort based
 * on league name patterns.
 */
export function inferCompetitionGender(name: string): CompetitionGender | null {
  const lower = name.toLowerCase();

  if (
    lower.includes("frauen") ||
    lower.includes("damen") ||
    lower.includes("women") ||
    lower.includes("féminin")
  ) {
    return "FEMALE";
  }

  if (lower.includes("männer") || lower.includes("herren") || lower.includes("men")) {
    return "MALE";
  }

  return null;
}

// ── Change detection ───────────────────────────────────────────────────────────

type ExistingCompetitionRow = {
  officialName: string;
  groupName: string | null;
};

/**
 * Returns true when the incoming competition data differs from the existing row.
 */
export function hasCompetitionChanges(
  existing: ExistingCompetitionRow,
  incoming: ExtractedSfvCompetition,
): boolean {
  return (
    existing.officialName !== incoming.officialName ||
    existing.groupName !== incoming.groupName
  );
}
