/**
 * lib/teams/team-competition-display.ts
 *
 * Provider-neutral competition display resolution for authenticated Team Cockpit
 * surfaces. Intentionally free of SFV/React/UI concerns — callers supply
 * already-resolved domain context and receive a presentation-ready label set.
 */

import { getSeasonKeyLookupCandidatesFromSfvExternalSeasonId } from "@/lib/integrations/sfv/season-bridge";
import type { SportingStandingsCompetition } from "@/lib/sporting-data/standings-types";

export type TeamCompetitionDisplaySource =
  | "STANDINGS"
  | "PROVIDER_MAPPING"
  | "CANONICAL_COMPETITION";

export type TeamCompetitionDisplay = {
  name: string;
  shortName?: string | null;
  divisionName?: string | null;
  groupName?: string | null;
  source: TeamCompetitionDisplaySource;
};

export type TeamCanonicalCompetitionContext = {
  name: string;
  shortName?: string | null;
};

export type ResolveTeamCompetitionDisplayInput = {
  /** Priority 1 — when a standings table was already resolved for the caller. */
  standingsCompetition?: SportingStandingsCompetition | null;
  /** Priority 2 — current-season SFV mapping league name. */
  providerLeagueName?: string | null;
  /** Priority 3 — canonical TeamSeasonCompetition -> Competition. */
  canonicalCompetition?: TeamCanonicalCompetitionContext | null;
};

function meaningful(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Deterministic competition display resolver.
 *
 * Priority:
 *   1. Standings competition context
 *   2. providerLeagueName from current-season mapping
 *   3. TeamSeasonCompetition -> Competition
 *   4. null
 */
export function resolveTeamCompetitionDisplay(
  input: ResolveTeamCompetitionDisplayInput,
): TeamCompetitionDisplay | null {
  const standingsName = meaningful(input.standingsCompetition?.name);
  if (standingsName) {
    return {
      name: standingsName,
      divisionName: meaningful(input.standingsCompetition?.divisionName ?? null),
      groupName: meaningful(input.standingsCompetition?.groupName ?? null),
      source: "STANDINGS",
    };
  }

  const providerLeagueName = meaningful(input.providerLeagueName);
  if (providerLeagueName) {
    return {
      name: providerLeagueName,
      source: "PROVIDER_MAPPING",
    };
  }

  const canonicalName =
    meaningful(input.canonicalCompetition?.shortName) ??
    meaningful(input.canonicalCompetition?.name);
  if (canonicalName) {
    return {
      name: meaningful(input.canonicalCompetition?.name) ?? canonicalName,
      shortName: meaningful(input.canonicalCompetition?.shortName ?? null),
      source: "CANONICAL_COMPETITION",
    };
  }

  return null;
}

export type CurrentSeasonSfvMappingRecord = {
  provider: string;
  providerLeagueName: string | null;
  providerLeagueId: number | null;
  externalTeamId: number;
  externalSeasonId: number;
  teamSeasonId: string | null;
};

/**
 * Returns the mapping only when it belongs to the requested current TeamSeason
 * and its externalSeasonId aligns with that season's key.
 */
export function resolveCurrentSeasonSfvMapping(
  mapping: CurrentSeasonSfvMappingRecord | null | undefined,
  input: {
    teamSeasonId: string;
    seasonKey: string;
  },
): CurrentSeasonSfvMappingRecord | null {
  if (!mapping) {
    return null;
  }

  if (mapping.teamSeasonId !== input.teamSeasonId) {
    return null;
  }

  const seasonCandidates = getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(
    mapping.externalSeasonId,
  );

  if (!seasonCandidates.includes(input.seasonKey)) {
    return null;
  }

  return mapping;
}

/**
 * Primary user-facing label for cockpit headers and overview tiles.
 */
export function formatTeamCompetitionDisplayLabel(
  display: TeamCompetitionDisplay | null,
): string | null {
  if (!display) {
    return null;
  }

  return meaningful(display.shortName) ?? meaningful(display.name);
}
