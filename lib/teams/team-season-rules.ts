/**
 * lib/teams/team-season-rules.ts
 *
 * Pure business-logic helpers for Team and TeamSeason entities.
 *
 * Design invariants:
 *   - All functions are pure (no I/O, no DB access, no side effects).
 *   - No tenant-specific constants or hardcoded club names.
 *   - buildTeamSeasonDisplayName() is tenant-neutral since TEAM-CORE-02.
 *     The caller is responsible for providing the club display name when
 *     one is needed (e.g. from Tenant.name). No default club prefix is applied.
 *   - getEffectiveTeamSeasonVisibility() centralises the seasonal → team
 *     visibility fallback semantics. Scatter logic in callers is forbidden.
 *
 * Visibility inheritance semantics (TEAM-CORE-02):
 *   TeamSeason.websiteVisible and TeamSeason.infoboardVisible are the canonical
 *   seasonal values. Team.websiteVisible and Team.infoboardVisible are the
 *   transitional fallback fields retained for backward compatibility.
 *   Use getEffectiveTeamSeasonVisibility() to resolve the effective value.
 */

import {
  getCurrentSwissFootballSeason,
  getSwissFootballSeasonStartYearFromDate,
} from "@/lib/seasons/season-logic";

export function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTeamSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds the display name for a TeamSeason.
 *
 * TEAM-CORE-02: No FC Allschwil-specific or club-specific prefix is applied
 * by default. The caller must explicitly provide `clubDisplayName` when the
 * display name should include the club name (e.g. for external feeds).
 *
 * This function is tenant-neutral: it has no knowledge of any club name.
 *
 * @param teamName          The canonical team name (e.g. "E-Junioren 1").
 * @param clubDisplayName   Optional club prefix (e.g. "FC Allschwil").
 *                          When provided, the result is "<club> <team>".
 *                          When omitted or empty, the result is "<team>" only.
 *
 * @example
 *   buildTeamSeasonDisplayName("E-Junioren 1")
 *   // → "E-Junioren 1"
 *
 * @example
 *   buildTeamSeasonDisplayName("E-Junioren 1", "FC Allschwil")
 *   // → "FC Allschwil E-Junioren 1"
 *
 * @example
 *   buildTeamSeasonDisplayName("  E-Junioren  1  ", "  FC Allschwil  ")
 *   // → "FC Allschwil E-Junioren 1"
 */
export function buildTeamSeasonDisplayName(
  teamName: string,
  clubDisplayName?: string | null,
): string {
  const normalizedTeam = normalizeTeamName(teamName);
  const normalizedClub =
    clubDisplayName && clubDisplayName.trim().length > 0
      ? normalizeTeamName(clubDisplayName)
      : null;

  if (normalizedClub && normalizedTeam) {
    return normalizedClub + " " + normalizedTeam;
  }
  if (normalizedClub) {
    return normalizedClub;
  }
  return normalizedTeam;
}

export function buildTeamSeasonShortName(teamName: string): string {
  return normalizeTeamName(teamName);
}

export function isFutureSeasonComparedToCurrentSeason(
  seasonStartDate: string | Date
): boolean {
  const selectedStartYear = getSwissFootballSeasonStartYearFromDate(seasonStartDate);
  const currentSeason = getCurrentSwissFootballSeason();

  if (selectedStartYear === null || !currentSeason) {
    return false;
  }

  return selectedStartYear > currentSeason.startYear;
}

// ---------------------------------------------------------------------------
// Visibility helpers — TEAM-CORE-02
// ---------------------------------------------------------------------------
//
// TeamSeason carries the canonical seasonal visibility flags.
// Team carries the transitional fallback flags for backward compatibility.
//
// Effective visibility rules:
//   effectiveWebsiteVisible =
//     teamSeason?.websiteVisible ?? team.websiteVisible
//   effectiveInfoboardVisible =
//     teamSeason?.infoboardVisible ?? team.infoboardVisible
//
// Do NOT scatter this logic across modules. All callers must use these helpers.
// ---------------------------------------------------------------------------

/**
 * Returns the effective website visibility for a team/season context.
 *
 * TeamSeason value takes precedence. Falls back to Team value when no
 * TeamSeason is available.
 */
export function getEffectiveWebsiteVisible(
  teamSeasonVisible: boolean | null | undefined,
  teamVisible: boolean,
): boolean {
  if (teamSeasonVisible === null || teamSeasonVisible === undefined) {
    return teamVisible;
  }
  return teamSeasonVisible;
}

/**
 * Returns the effective infoboard visibility for a team/season context.
 *
 * TeamSeason value takes precedence. Falls back to Team value when no
 * TeamSeason is available.
 */
export function getEffectiveInfoboardVisible(
  teamSeasonVisible: boolean | null | undefined,
  teamVisible: boolean,
): boolean {
  if (teamSeasonVisible === null || teamSeasonVisible === undefined) {
    return teamVisible;
  }
  return teamSeasonVisible;
}

/**
 * Resolves effective website and infoboard visibility from team and optional
 * team-season context.
 *
 * Centralises the fallback logic for both visibility dimensions in one call.
 */
export function getEffectiveTeamSeasonVisibility(
  teamSeason: { websiteVisible: boolean; infoboardVisible: boolean } | null | undefined,
  team: { websiteVisible: boolean; infoboardVisible: boolean },
): { websiteVisible: boolean; infoboardVisible: boolean } {
  return {
    websiteVisible: getEffectiveWebsiteVisible(
      teamSeason?.websiteVisible,
      team.websiteVisible,
    ),
    infoboardVisible: getEffectiveInfoboardVisible(
      teamSeason?.infoboardVisible,
      team.infoboardVisible,
    ),
  };
}
