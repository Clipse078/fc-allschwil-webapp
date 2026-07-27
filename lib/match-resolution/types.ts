/**
 * lib/match-resolution/types.ts
 *
 * Canonical type definitions for the Match Resolution layer (MATCH-RESOLUTION-01).
 *
 * The resolver receives provider-neutral DTOs, queries canonical mappings
 * (TeamExternalMapping → TeamSeason), and produces a ResolvedMatch describing
 * the resolution outcome. No provider-specific types appear here.
 *
 * Architecture invariants:
 *   - All operations are tenant-scoped.
 *   - No provider-specific imports or logic.
 *   - Competition is validation context only — never used to identify a TeamSeason.
 *   - Only canonical mappings are used — no fuzzy matching.
 */

// ── Resolution status ─────────────────────────────────────────────────────────

/**
 * Outcome of a canonical match resolution attempt.
 *
 *   RESOLVED           — Both home and away TeamSeasons resolved without errors.
 *   PARTIALLY_RESOLVED — At least one TeamSeason resolved; the other could not.
 *   UNRESOLVED         — Neither TeamSeason could be resolved.
 *   INVALID_MAPPING    — A mapping exists but references an invalid entity
 *                        (e.g. archived TeamSeason, tenant mismatch).
 *   CONFLICT           — Duplicate or contradictory mappings were detected.
 */
export type ResolutionStatus =
  | "RESOLVED"
  | "PARTIALLY_RESOLVED"
  | "UNRESOLVED"
  | "INVALID_MAPPING"
  | "CONFLICT";

// ── Confidence ────────────────────────────────────────────────────────────────

/**
 * Overall confidence in the resolution result.
 *
 *   HIGH   — Both sides resolved; competition validated (when available).
 *   MEDIUM — One side resolved or competition validation not possible.
 *   LOW    — Neither side resolved or multiple errors present.
 *   NONE   — No resolution was possible.
 */
export type ResolutionConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

// ── Error codes ───────────────────────────────────────────────────────────────

/**
 * Canonical error codes produced by the Match Resolution layer.
 *
 * Each code maps to a specific failure category. Codes are stable
 * machine-readable identifiers — do not change them between versions.
 */
export type ResolutionErrorCode =
  | "TEAM_MAPPING_NOT_FOUND"
  | "COMPETITION_MISMATCH"
  | "ARCHIVED_TEAM"
  | "ARCHIVED_COMPETITION"
  | "PROVIDER_NOT_SUPPORTED"
  | "DUPLICATE_MAPPING"
  | "TENANT_MISMATCH"
  | "TEAM_SEASON_NOT_LINKED";

// ── Team side ─────────────────────────────────────────────────────────────────

/** Which side (home or away) a resolution error or warning applies to. */
export type MatchSide = "home" | "away";

// ── Resolution error ──────────────────────────────────────────────────────────

/**
 * A single canonical error produced during resolution.
 *
 * Errors are always recorded — they are never silently suppressed.
 * Safe to log and display to administrators.
 */
export type ResolutionError = {
  /** Stable machine-readable error code. */
  code: ResolutionErrorCode;
  /** Human-readable description of the failure. */
  message: string;
  /** Which match side this error applies to. Null when side-independent. */
  side: MatchSide | null;
};

// ── Input DTOs ────────────────────────────────────────────────────────────────

/**
 * Input DTO for resolving a single imported match.
 *
 * Contains only provider-neutral identifiers — no provider-specific types.
 * The resolver uses these identifiers to look up canonical mappings.
 */
export type MatchResolutionInput = {
  /** Owning tenant identifier. All lookups are scoped to this tenant. */
  tenantId: string;
  /** Provider key (e.g. "SFV"). Must be registered in the provider registry. */
  provider: string;
  /** Provider-assigned match identifier. */
  externalMatchId: number;
  /** Provider-assigned season identifier. */
  externalSeasonId: number;
  /** Provider team identifier for the home side. */
  providerHomeTeamId: number;
  /** Provider team identifier for the away side. */
  providerAwayTeamId: number;
  /**
   * Provider competition identifier (e.g. league ID).
   * Used as validation context only — never to identify a TeamSeason.
   * Null when the provider does not supply a competition identifier.
   */
  providerCompetitionId: number | null;
};

/**
 * Input for batch resolution of all match mappings within a provider/season scope.
 */
export type ScheduleBatchResolutionInput = {
  tenantId: string;
  provider: string;
  externalSeasonId: number;
};

// ── Output DTOs ───────────────────────────────────────────────────────────────

/**
 * Canonical resolution result for a single imported match.
 *
 * Produced by MatchResolutionService.resolveImportedMatch().
 * Safe to persist to MatchExternalMapping resolved columns.
 */
export type ResolvedMatch = {
  /** Canonical TeamSeason ID for the home side. Null when unresolved. */
  resolvedHomeTeamSeasonId: string | null;
  /** Canonical TeamSeason ID for the away side. Null when unresolved. */
  resolvedAwayTeamSeasonId: string | null;
  /** Canonical Competition ID used as validation context. Null when unavailable. */
  resolvedCompetitionId: string | null;
  /** Overall resolution status. */
  resolutionStatus: ResolutionStatus;
  /** All errors encountered during resolution. Empty when fully resolved. */
  resolutionErrors: ResolutionError[];
  /** Informational warnings (non-blocking). Competition validation mismatches. */
  resolutionWarnings: string[];
  /** Confidence in the resolution result. */
  confidence: ResolutionConfidence;
};

// ── Per-side outcome ──────────────────────────────────────────────────────────

/**
 * Outcome of resolving a single team side (home or away).
 *
 * Used internally and returned from resolveHomeTeamSeason / resolveAwayTeamSeason.
 */
export type TeamSeasonResolutionOutcome =
  | {
      ok: true;
      /** Resolved TeamSeason ID. Null when mapping exists but has no seasonal link. */
      teamSeasonId: string | null;
      /** Optional informational message. */
      info?: string;
    }
  | {
      ok: false;
      error: ResolutionError;
    };

/**
 * Outcome of resolving a competition by provider identifier.
 *
 * Used internally and returned from resolveCompetition.
 */
export type CompetitionResolutionOutcome =
  | {
      ok: true;
      competitionId: string;
      isArchived: boolean;
    }
  | {
      ok: false;
      error: ResolutionError;
    };

/**
 * Outcome of validating a provider key against the registry.
 *
 * Used internally and returned from resolveProviderOwnership.
 */
export type ProviderOwnershipOutcome =
  | { ok: true; providerKey: string }
  | { ok: false; error: ResolutionError };

// ── Batch resolution summary ──────────────────────────────────────────────────

/**
 * Aggregate result of resolveScheduleBatch().
 *
 * Counts are non-negative integers. Safe to include in sync result output.
 */
export type BatchResolutionSummary = {
  /** Number of matches where both sides resolved successfully. */
  resolved: number;
  /** Number of matches where at least one side resolved. */
  partiallyResolved: number;
  /** Number of matches where neither side resolved. */
  unresolved: number;
  /** Number of matches where a mapping was found but is invalid. */
  invalid: number;
  /** Number of matches with conflicting mappings. */
  conflicts: number;
  /** Number of matches where resolution itself failed (DB error, etc.). */
  failed: number;
  /** Total matches processed. */
  total: number;
};

// ── Validation result ─────────────────────────────────────────────────────────

/**
 * Result of validateResolution().
 *
 * Checks a ResolvedMatch for logical consistency and completeness.
 */
export type ResolutionValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ── Raw DB query shapes ───────────────────────────────────────────────────────

/**
 * Minimal shape of a MatchExternalMapping row loaded for batch resolution.
 */
export type MatchMappingForResolution = {
  id: string;
  externalMatchId: number;
  externalSeasonId: number;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  providerLeagueId: number | null;
};

/**
 * Minimal shape of a TeamExternalMapping row loaded for resolution.
 */
export type TeamMappingForResolution = {
  externalTeamId: number;
  teamSeasonId: string | null;
  teamId: string;
  providerIsActive: boolean;
  teamSeason: {
    id: string;
    status: string;
    team: { tenantId: string | null };
  } | null;
};

/**
 * Minimal shape of a Competition row loaded for resolution.
 */
export type CompetitionForResolution = {
  id: string;
  externalCompetitionId: number | null;
  isArchived: boolean;
};
