/**
 * lib/matchcenter/team-display.ts
 *
 * MATCHCENTER-UX-01 — TEAM-IDENTITY-01 compact naming integration for
 * Matchcenter rows.
 *
 * Reuses the single canonical naming contract from lib/teams/team-naming.ts
 * (established by TEAM-IDENTITY-01 / PR #309) instead of reimplementing the
 * shortName → name → alternativeName → providerTeamName fallback chain.
 */

import { resolveCompactTeamName } from "@/lib/teams/team-naming";
import type { MatchcenterSide } from "./types";

/**
 * Resolves the best compact (space-constrained) display name for a
 * Matchcenter side.
 *
 * Priority: Team.shortName → Team.name → Team.alternativeName →
 * providerTeamName → the side's already-computed long `displayName` as a
 * final safety net (covers manually-created matches with only a free-text
 * fallback name and no provider/canonical data at all).
 */
export function resolveMatchcenterCompactSideName(
  side: MatchcenterSide,
): string {
  // CLUB-DIRECTORY-02: when this side has no canonical tenant Team, fall
  // back to the canonical Club Directory ExternalTeam's tenant-managed
  // name/shortName/alternativeName before the raw provider name — reusing
  // the same tested naming contract, never a second naming scheme.
  const resolved = resolveCompactTeamName({
    teamName: side.canonicalTeamName ?? side.canonicalExternalTeamName ?? null,
    teamShortName:
      side.canonicalTeamShortName ?? side.canonicalExternalTeamShortName ?? null,
    teamAlternativeName:
      side.canonicalTeamAlternativeName ??
      side.canonicalExternalTeamAlternativeName ??
      null,
    providerTeamName: side.providerTeamName,
  });

  return resolved ?? side.displayName;
}
