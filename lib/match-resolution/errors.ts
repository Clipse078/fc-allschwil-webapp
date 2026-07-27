/**
 * lib/match-resolution/errors.ts
 *
 * Canonical error factory functions for the Match Resolution layer.
 *
 * All errors are typed ResolutionError values — never raw Error instances.
 * Error messages are human-readable and safe to log to admin interfaces.
 *
 * Architecture invariants:
 *   - No provider-specific content in error messages.
 *   - All messages are English (localisation happens at presentation layer).
 *   - Side context (home/away) is always included when applicable.
 */

import type { ResolutionError, MatchSide } from "./types";

export function teamMappingNotFound(side: MatchSide, externalTeamId: number): ResolutionError {
  return {
    code: "TEAM_MAPPING_NOT_FOUND",
    message: `No TeamExternalMapping found for ${side} team (externalTeamId=${externalTeamId}).`,
    side,
  };
}

export function teamSeasonNotLinked(side: MatchSide, externalTeamId: number): ResolutionError {
  return {
    code: "TEAM_SEASON_NOT_LINKED",
    message: `TeamExternalMapping for ${side} team (externalTeamId=${externalTeamId}) has no TeamSeason link. Run team sync and map the team first.`,
    side,
  };
}

export function archivedTeam(side: MatchSide, teamSeasonId: string): ResolutionError {
  return {
    code: "ARCHIVED_TEAM",
    message: `TeamSeason (id=${teamSeasonId}) for ${side} team is archived and cannot own matches.`,
    side,
  };
}

export function archivedCompetition(competitionId: string): ResolutionError {
  return {
    code: "ARCHIVED_COMPETITION",
    message: `Competition (id=${competitionId}) is archived and cannot be used as resolution context.`,
    side: null,
  };
}

export function tenantMismatch(side: MatchSide, entityType: string, entityId: string): ResolutionError {
  return {
    code: "TENANT_MISMATCH",
    message: `${entityType} (id=${entityId}) for ${side} team belongs to a different tenant.`,
    side,
  };
}

export function providerNotSupported(provider: string): ResolutionError {
  return {
    code: "PROVIDER_NOT_SUPPORTED",
    message: `Provider "${provider}" is not supported. No adapter registered.`,
    side: null,
  };
}

export function duplicateMapping(side: MatchSide, externalTeamId: number): ResolutionError {
  return {
    code: "DUPLICATE_MAPPING",
    message: `Multiple active TeamExternalMapping rows found for ${side} team (externalTeamId=${externalTeamId}). This indicates a data integrity issue.`,
    side,
  };
}

export function competitionMismatch(side: MatchSide, teamSeasonId: string, competitionId: string): string {
  return `TeamSeason (id=${teamSeasonId}) for ${side} is not registered in Competition (id=${competitionId}). This may indicate an incorrect mapping.`;
}
