/**
 * lib/match-resolution/match-resolution-service.ts
 *
 * Canonical Match Resolution Service (MATCH-RESOLUTION-01).
 *
 * Automatically resolves imported provider matches to the correct canonical
 * TeamSeason using the provider mapping foundation (TeamExternalMapping).
 *
 * Public API:
 *   resolveImportedMatch()      — resolve a single imported match
 *   resolveHomeTeamSeason()     — resolve home side TeamSeason
 *   resolveAwayTeamSeason()     — resolve away side TeamSeason
 *   resolveCompetition()        — resolve Competition by provider identifier
 *   resolveProviderOwnership()  — validate provider registration
 *   validateResolution()        — validate a ResolvedMatch for consistency
 *   resolveScheduleBatch()      — batch-resolve all matches in a provider/season scope
 *
 * Architecture invariants:
 *   - No provider-specific imports or logic.
 *   - Provider key is treated as a plain string.
 *   - All operations are tenant-scoped.
 *   - Competition is validation context only — never used to identify a TeamSeason.
 *   - No fuzzy matching — only canonical TeamExternalMapping lookups.
 *   - Errors are always recorded, never silently suppressed.
 *   - Conflicts are never silently resolved.
 *
 * Resolution order (per side):
 *   1. Validate provider registration (PROVIDER_NOT_SUPPORTED guard)
 *   2. Look up TeamExternalMapping → TeamSeason
 *   3. Validate tenant isolation
 *   4. Validate TeamSeason is not archived
 *   5. Optionally validate Competition membership (warning, not error)
 */

import { getProviderAdapter } from "@/lib/provider-mapping/provider-registry";
import type {
  MatchResolutionInput,
  ScheduleBatchResolutionInput,
  ResolvedMatch,
  TeamSeasonResolutionOutcome,
  CompetitionResolutionOutcome,
  ProviderOwnershipOutcome,
  ResolutionStatus,
  ResolutionConfidence,
  ResolutionValidationResult,
  BatchResolutionSummary,
} from "./types";
import {
  teamMappingNotFound,
  teamSeasonNotLinked,
  archivedTeam,
  archivedCompetition,
  tenantMismatch,
  providerNotSupported,
  duplicateMapping,
  competitionMismatch,
} from "./errors";
import {
  findTeamMappingForResolution,
  countTeamMappings,
  findCompetitionForResolution,
  isTeamSeasonInCompetition,
  loadMatchMappingsForResolution,
  persistMatchResolution,
} from "./queries";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves a single imported match to canonical TeamSeason references.
 *
 * Steps:
 *   1. Validate provider registration.
 *   2. Resolve home TeamSeason via TeamExternalMapping.
 *   3. Resolve away TeamSeason via TeamExternalMapping.
 *   4. Resolve Competition (when providerCompetitionId is present).
 *   5. Validate competition membership for resolved sides (warnings only).
 *   6. Compute resolution status and confidence.
 *
 * Never throws. All errors are captured in ResolvedMatch.resolutionErrors.
 */
export async function resolveImportedMatch(
  input: MatchResolutionInput,
): Promise<ResolvedMatch> {
  const {
    tenantId,
    provider,
    providerHomeTeamId,
    providerAwayTeamId,
    externalSeasonId,
    providerCompetitionId,
  } = input;

  const resolutionErrors: ResolvedMatch["resolutionErrors"] = [];
  const resolutionWarnings: string[] = [];

  // 1. Validate provider registration
  const ownershipResult = resolveProviderOwnership(provider);
  if (!ownershipResult.ok) {
    resolutionErrors.push(ownershipResult.error);
    return buildUnresolved(resolutionErrors, resolutionWarnings);
  }

  // 2 & 3. Resolve both team sides in parallel
  const [homeResult, awayResult] = await Promise.all([
    resolveHomeTeamSeason(tenantId, provider, providerHomeTeamId, externalSeasonId),
    resolveAwayTeamSeason(tenantId, provider, providerAwayTeamId, externalSeasonId),
  ]);

  if (!homeResult.ok) {
    resolutionErrors.push(homeResult.error);
  }
  if (!awayResult.ok) {
    resolutionErrors.push(awayResult.error);
  }

  const resolvedHomeTeamSeasonId = homeResult.ok ? (homeResult.teamSeasonId ?? null) : null;
  const resolvedAwayTeamSeasonId = awayResult.ok ? (awayResult.teamSeasonId ?? null) : null;

  // 4. Resolve Competition (validation context only)
  let resolvedCompetitionId: string | null = null;

  if (providerCompetitionId !== null) {
    const competitionResult = await resolveCompetition(
      tenantId,
      provider,
      providerCompetitionId,
      externalSeasonId,
    );

    if (competitionResult.ok) {
      if (competitionResult.isArchived) {
        resolutionErrors.push(archivedCompetition(competitionResult.competitionId));
      } else {
        resolvedCompetitionId = competitionResult.competitionId;

        // 5. Validate competition membership (warnings only — not blocking)
        if (resolvedHomeTeamSeasonId) {
          const inComp = await isTeamSeasonInCompetition(
            resolvedHomeTeamSeasonId,
            resolvedCompetitionId,
          );
          if (!inComp) {
            resolutionWarnings.push(
              competitionMismatch("home", resolvedHomeTeamSeasonId, resolvedCompetitionId),
            );
          }
        }

        if (resolvedAwayTeamSeasonId) {
          const inComp = await isTeamSeasonInCompetition(
            resolvedAwayTeamSeasonId,
            resolvedCompetitionId,
          );
          if (!inComp) {
            resolutionWarnings.push(
              competitionMismatch("away", resolvedAwayTeamSeasonId, resolvedCompetitionId),
            );
          }
        }
      }
    }
    // Competition not found: informational only — no error added
    // The provider competition may not be synced yet; this is expected.
  }

  // 6. Compute resolution status and confidence
  const resolutionStatus = computeResolutionStatus(
    resolvedHomeTeamSeasonId,
    resolvedAwayTeamSeasonId,
    resolutionErrors,
  );

  const confidence = computeConfidence(
    resolvedHomeTeamSeasonId,
    resolvedAwayTeamSeasonId,
    resolvedCompetitionId,
    resolutionErrors,
    resolutionWarnings,
  );

  return {
    resolvedHomeTeamSeasonId,
    resolvedAwayTeamSeasonId,
    resolvedCompetitionId,
    resolutionStatus,
    resolutionErrors,
    resolutionWarnings,
    confidence,
  };
}

/**
 * Resolves the canonical TeamSeason for the home side of a match.
 *
 * Lookup chain:
 *   provider + externalTeamId + externalSeasonId
 *   → TeamExternalMapping
 *   → TeamSeason
 *
 * Validates:
 *   - Mapping exists for this tenant/provider/team/season
 *   - No duplicate mappings (conflict detection)
 *   - TeamSeason is linked (teamSeasonId IS NOT NULL)
 *   - TeamSeason belongs to the correct tenant
 *   - TeamSeason is not archived
 */
export async function resolveHomeTeamSeason(
  tenantId: string,
  provider: string,
  providerHomeTeamId: number,
  externalSeasonId: number,
): Promise<TeamSeasonResolutionOutcome> {
  return resolveTeamSide(tenantId, provider, providerHomeTeamId, externalSeasonId, "home");
}

/**
 * Resolves the canonical TeamSeason for the away side of a match.
 *
 * Same lookup chain and validations as resolveHomeTeamSeason.
 */
export async function resolveAwayTeamSeason(
  tenantId: string,
  provider: string,
  providerAwayTeamId: number,
  externalSeasonId: number,
): Promise<TeamSeasonResolutionOutcome> {
  return resolveTeamSide(tenantId, provider, providerAwayTeamId, externalSeasonId, "away");
}

/**
 * Resolves a canonical Competition by provider competition identifier.
 *
 * Competition is used as validation context only — never to identify a TeamSeason.
 *
 * Returns ok: true when a matching competition is found (archived or not).
 * The caller must check isArchived before using the competition.
 *
 * Returns ok: false only when no competition record exists in the DB.
 * Competition not found is not recorded as an error — competition sync may
 * not have run yet.
 */
export async function resolveCompetition(
  tenantId: string,
  provider: string,
  externalCompetitionId: number,
  externalSeasonId: number,
): Promise<CompetitionResolutionOutcome> {
  const competition = await findCompetitionForResolution(
    tenantId,
    provider,
    externalCompetitionId,
    externalSeasonId,
  );

  if (!competition) {
    return {
      ok: false,
      error: {
        code: "COMPETITION_MISMATCH",
        message: `No Competition found for provider=${provider} externalCompetitionId=${externalCompetitionId} externalSeasonId=${externalSeasonId}.`,
        side: null,
      },
    };
  }

  return {
    ok: true,
    competitionId: competition.id,
    isArchived: competition.isArchived,
  };
}

/**
 * Validates that a provider is registered in the canonical provider registry.
 *
 * Returns ok: true when an adapter is registered for this provider key.
 * Returns ok: false with PROVIDER_NOT_SUPPORTED when no adapter is found.
 *
 * Synchronous — the provider registry is in-memory.
 */
export function resolveProviderOwnership(provider: string): ProviderOwnershipOutcome {
  const adapter = getProviderAdapter(provider);
  if (!adapter) {
    return {
      ok: false,
      error: providerNotSupported(provider),
    };
  }
  return { ok: true, providerKey: adapter.providerKey };
}

/**
 * Validates a ResolvedMatch for logical consistency.
 *
 * Checks:
 *   - RESOLVED status requires both TeamSeason IDs to be non-null
 *   - PARTIALLY_RESOLVED requires exactly one TeamSeason ID to be non-null
 *   - UNRESOLVED requires both TeamSeason IDs to be null
 *   - No CONFLICT or INVALID_MAPPING without at least one error
 *
 * Used for service-layer assertions and test coverage.
 */
export function validateResolution(resolved: ResolvedMatch): ResolutionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const homeResolved = resolved.resolvedHomeTeamSeasonId !== null;
  const awayResolved = resolved.resolvedAwayTeamSeasonId !== null;

  switch (resolved.resolutionStatus) {
    case "RESOLVED":
      if (!homeResolved || !awayResolved) {
        errors.push("RESOLVED status requires both home and away TeamSeason IDs to be set.");
      }
      break;
    case "PARTIALLY_RESOLVED":
      if (homeResolved === awayResolved) {
        errors.push(
          "PARTIALLY_RESOLVED status requires exactly one side to be resolved.",
        );
      }
      break;
    case "UNRESOLVED":
      if (homeResolved || awayResolved) {
        errors.push(
          "UNRESOLVED status requires both TeamSeason IDs to be null.",
        );
      }
      break;
    case "CONFLICT":
    case "INVALID_MAPPING":
      if (resolved.resolutionErrors.length === 0) {
        errors.push(
          `${resolved.resolutionStatus} status requires at least one error to be recorded.`,
        );
      }
      break;
  }

  if (resolved.confidence === "HIGH" && (!homeResolved || !awayResolved)) {
    warnings.push("HIGH confidence set but not both sides are resolved.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Batch-resolves all MatchExternalMapping rows within a provider/season scope.
 *
 * Steps:
 *   1. Load all match mappings for this tenant/provider/season.
 *   2. For each mapping, run resolveImportedMatch().
 *   3. Persist the resolution result to the MatchExternalMapping row.
 *   4. Accumulate counts for the summary.
 *
 * Resolution failures for individual matches are counted in summary.failed
 * and do not halt the batch. Persistence failures are counted separately.
 *
 * Used by provider sync pipelines after the main import loop completes.
 */
export async function resolveScheduleBatch(
  input: ScheduleBatchResolutionInput,
): Promise<BatchResolutionSummary> {
  const { tenantId, provider, externalSeasonId } = input;

  const mappings = await loadMatchMappingsForResolution(tenantId, provider, externalSeasonId);

  let resolved = 0;
  let partiallyResolved = 0;
  let unresolved = 0;
  let invalid = 0;
  let conflicts = 0;
  let failed = 0;

  for (const mapping of mappings) {
    let resolutionResult: ResolvedMatch;

    try {
      resolutionResult = await resolveImportedMatch({
        tenantId,
        provider,
        externalMatchId: mapping.externalMatchId,
        externalSeasonId: mapping.externalSeasonId,
        providerHomeTeamId: mapping.providerHomeTeamId,
        providerAwayTeamId: mapping.providerAwayTeamId,
        providerCompetitionId: mapping.providerLeagueId ?? null,
      });
    } catch {
      failed++;
      continue;
    }

    try {
      await persistMatchResolution(
        mapping.id,
        resolutionResult.resolvedHomeTeamSeasonId,
        resolutionResult.resolvedAwayTeamSeasonId,
        resolutionResult.resolvedCompetitionId,
        resolutionResult.resolutionStatus,
        new Date(),
      );
    } catch {
      failed++;
      continue;
    }

    switch (resolutionResult.resolutionStatus) {
      case "RESOLVED":
        resolved++;
        break;
      case "PARTIALLY_RESOLVED":
        partiallyResolved++;
        break;
      case "UNRESOLVED":
        unresolved++;
        break;
      case "INVALID_MAPPING":
        invalid++;
        break;
      case "CONFLICT":
        conflicts++;
        break;
    }
  }

  return {
    resolved,
    partiallyResolved,
    unresolved,
    invalid,
    conflicts,
    failed,
    total: mappings.length,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Shared team-side resolution logic used by both resolveHomeTeamSeason and
 * resolveAwayTeamSeason.
 *
 * Resolution order:
 *   1. Check for duplicate mappings (CONFLICT)
 *   2. Find the mapping row
 *   3. Validate tenant isolation
 *   4. Validate TeamSeason link exists
 *   5. Validate TeamSeason is not archived
 */
async function resolveTeamSide(
  tenantId: string,
  provider: string,
  externalTeamId: number,
  externalSeasonId: number,
  side: "home" | "away",
): Promise<TeamSeasonResolutionOutcome> {
  // Duplicate check (defensive — unique constraint should prevent this)
  const count = await countTeamMappings(tenantId, provider, externalTeamId, externalSeasonId);
  if (count > 1) {
    return {
      ok: false,
      error: duplicateMapping(side, externalTeamId),
    };
  }

  const mapping = await findTeamMappingForResolution(
    tenantId,
    provider,
    externalTeamId,
    externalSeasonId,
  );

  if (!mapping) {
    // External opponent — not an error for away team, informational for home
    return {
      ok: true,
      teamSeasonId: null,
      info: `No TeamExternalMapping for ${side} team (externalTeamId=${externalTeamId}). Likely an external opponent.`,
    };
  }

  // Validate TeamSeason link
  if (!mapping.teamSeasonId || !mapping.teamSeason) {
    // Mapping exists but has no seasonal link — needs team mapping
    return {
      ok: false,
      error: teamSeasonNotLinked(side, externalTeamId),
    };
  }

  // Tenant isolation
  const teamTenantId = mapping.teamSeason.team.tenantId;
  if (teamTenantId !== null && teamTenantId !== tenantId) {
    return {
      ok: false,
      error: tenantMismatch(side, "TeamSeason", mapping.teamSeason.id),
    };
  }

  // Archived check
  if (mapping.teamSeason.status === "ARCHIVED") {
    return {
      ok: false,
      error: archivedTeam(side, mapping.teamSeason.id),
    };
  }

  return {
    ok: true,
    teamSeasonId: mapping.teamSeasonId,
  };
}

/**
 * Computes the ResolutionStatus from the per-side resolution outcomes and errors.
 */
function computeResolutionStatus(
  resolvedHomeTeamSeasonId: string | null,
  resolvedAwayTeamSeasonId: string | null,
  errors: ResolvedMatch["resolutionErrors"],
): ResolutionStatus {
  const hasConflict = errors.some((e) => e.code === "DUPLICATE_MAPPING");
  if (hasConflict) return "CONFLICT";

  const hasInvalidMapping = errors.some(
    (e) =>
      e.code === "TENANT_MISMATCH" ||
      e.code === "ARCHIVED_TEAM" ||
      e.code === "ARCHIVED_COMPETITION" ||
      e.code === "TEAM_SEASON_NOT_LINKED",
  );
  if (hasInvalidMapping) return "INVALID_MAPPING";

  const homeResolved = resolvedHomeTeamSeasonId !== null;
  const awayResolved = resolvedAwayTeamSeasonId !== null;

  if (homeResolved && awayResolved) return "RESOLVED";
  if (homeResolved || awayResolved) return "PARTIALLY_RESOLVED";
  return "UNRESOLVED";
}

/**
 * Computes confidence based on resolution completeness and error/warning counts.
 */
function computeConfidence(
  resolvedHomeTeamSeasonId: string | null,
  resolvedAwayTeamSeasonId: string | null,
  resolvedCompetitionId: string | null,
  errors: ResolvedMatch["resolutionErrors"],
  warnings: string[],
): ResolutionConfidence {
  if (errors.length > 0) return "LOW";

  const homeResolved = resolvedHomeTeamSeasonId !== null;
  const awayResolved = resolvedAwayTeamSeasonId !== null;

  if (!homeResolved && !awayResolved) return "NONE";

  if (homeResolved && awayResolved && resolvedCompetitionId !== null && warnings.length === 0) {
    return "HIGH";
  }

  if (homeResolved && awayResolved) {
    return warnings.length === 0 ? "HIGH" : "MEDIUM";
  }

  return "MEDIUM";
}

/**
 * Builds an UNRESOLVED ResolvedMatch for early returns (e.g. provider not found).
 */
function buildUnresolved(
  resolutionErrors: ResolvedMatch["resolutionErrors"],
  resolutionWarnings: string[],
): ResolvedMatch {
  return {
    resolvedHomeTeamSeasonId: null,
    resolvedAwayTeamSeasonId: null,
    resolvedCompetitionId: null,
    resolutionStatus: "UNRESOLVED",
    resolutionErrors,
    resolutionWarnings,
    confidence: "NONE",
  };
}
