/**
 * lib/match-results/match-result-service.ts
 *
 * Canonical match result service — SportClubEvo's source of truth for
 * match results regardless of federation or provider.
 *
 * Public API:
 *   updateMatchResult()    — persist a single canonical result from any provider.
 *   validateMatchResult()  — validate without persisting; returns warnings.
 *   resolveMatchStatus()   — translate a raw EventStatus to canonical MatchStatus.
 *   publishMatchResult()   — write the display result label to the Event.
 *   batchUpdateResults()   — process multiple result updates for a tenant.
 *
 * Architecture invariants:
 *   - NO provider-specific imports. Adapters translate before calling in.
 *   - All operations are tenant-scoped (tenantId is never trusted from caller body).
 *   - Updates are idempotent: calling with identical data is safe and produces
 *     no observable side-effects beyond updating lastSyncedAt.
 *   - Audit is best-effort: audit failure never aborts a mutation.
 *   - Manual override architecture is prepared but NOT implemented yet.
 *     (See MATCH-RESULTS-02 for manual editing.)
 *
 * Import flow:
 *   Provider sync → Provider Adapter → updateMatchResult() → persist → publish
 *
 * The module deliberately imports only from:
 *   ./types, ./errors, ./queries
 * to guarantee provider neutrality.
 */

import type {
  BatchUpdateResultItem,
  BatchUpdateResultsInput,
  BatchUpdateResultsOutput,
  MatchResult,
  MatchStatus,
  PublishMatchResultInput,
  UpdateMatchResultInput,
} from "./types";
import {
  buildResultLabel,
  isScoreableStatus,
  isTerminalStatus,
  MATCH_STATUS_VALUES,
  resolveCanonicalStatus,
  toEventStatus,
} from "./types";
import {
  invalidScore,
  invalidStatus,
  matchArchived,
  matchNotFound,
  tenantMismatch,
} from "./errors";
import type { MatchResultDatabase, MatchResultEventRecord } from "./queries";
import {
  loadMatchEvent,
  persistMatchResult,
  recordResultAudit,
  toMatchResult,
} from "./queries";

// Re-export mapping helpers so callers (e.g. provider adapters) can use them
// without depending on types.ts directly.
export { resolveCanonicalStatus, toEventStatus };

// ── Constants ──────────────────────────────────────────────────────────────

const SUPPORTED_PROVIDERS = ["SFV", "CLUBCORNER_FVNWS"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(p: string): p is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(p as SupportedProvider);
}

// ── Validation ─────────────────────────────────────────────────────────────

/** Validation warning (non-blocking). */
export interface MatchResultWarning {
  code: string;
  message: string;
}

/**
 * Validate a result update input. Returns a list of warnings.
 * Throws MatchResultError for hard violations.
 *
 * This is also called internally by updateMatchResult(); it can be
 * invoked separately to pre-validate before persisting.
 */
export function validateMatchResult(
  input: UpdateMatchResultInput,
  event: MatchResultEventRecord,
): string[] {
  const warnings: string[] = [];

  // ── Hard validations (throw) ───────────────────────────────────────────

  // Archived events cannot be updated
  if (event.status === "ARCHIVED") {
    throw matchArchived(input.matchId);
  }

  // Status must be a known canonical value
  if (
    input.status !== undefined &&
    !MATCH_STATUS_VALUES.includes(input.status as MatchStatus)
  ) {
    throw invalidStatus(
      `Unknown canonical status: ${String(input.status)}`,
    );
  }

  // Negative goals are always invalid
  if (input.homeGoals !== undefined && input.homeGoals !== null) {
    if (!Number.isInteger(input.homeGoals) || input.homeGoals < 0) {
      throw invalidScore(
        `homeGoals must be a non-negative integer, got: ${input.homeGoals}`,
      );
    }
  }

  if (input.awayGoals !== undefined && input.awayGoals !== null) {
    if (!Number.isInteger(input.awayGoals) || input.awayGoals < 0) {
      throw invalidScore(
        `awayGoals must be a non-negative integer, got: ${input.awayGoals}`,
      );
    }
  }

  // ── Soft validations (warn) ────────────────────────────────────────────

  const targetStatus = input.status ?? resolveCanonicalStatus(event.status);

  // Finished match without scores
  if (targetStatus === "FINISHED") {
    if (input.homeGoals === null || input.homeGoals === undefined) {
      warnings.push(
        "FINISHED match has no homeGoals — score will remain null",
      );
    }
    if (input.awayGoals === null || input.awayGoals === undefined) {
      warnings.push(
        "FINISHED match has no awayGoals — score will remain null",
      );
    }
  }

  // Cancelled match with a score
  if (
    (targetStatus === "CANCELLED" || targetStatus === "POSTPONED") &&
    (input.homeGoals !== null && input.homeGoals !== undefined) &&
    (input.awayGoals !== null && input.awayGoals !== undefined)
  ) {
    warnings.push(
      `${targetStatus} match has a score — score will be stored but may be unexpected`,
    );
  }

  // Score provided for a non-scoreable status
  if (
    !isScoreableStatus(targetStatus) &&
    ((input.homeGoals !== null && input.homeGoals !== undefined) ||
      (input.awayGoals !== null && input.awayGoals !== undefined))
  ) {
    if (targetStatus === "SCHEDULED") {
      warnings.push(
        "Score provided for SCHEDULED match — score will be stored but may be unexpected",
      );
    }
  }

  // Live score: at least one goal should be set if updating to LIVE
  if (targetStatus === "LIVE") {
    if (
      (input.homeGoals === null || input.homeGoals === undefined) &&
      (input.awayGoals === null || input.awayGoals === undefined)
    ) {
      warnings.push(
        "LIVE match has no score — will default to null until first score update",
      );
    }
  }

  return warnings;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Update the canonical result for a single match.
 *
 * Persists status, scores and provider state. Writes the display result
 * label (resultLabel) on FINISHED, ABANDONED and FORFEITED matches.
 * Records an audit entry after a successful mutation.
 *
 * Idempotent: calling with identical data produces the same DB state.
 * Only lastSyncedAt is unconditionally updated on each call.
 *
 * @param database  Injectable DB port.
 * @param input     Canonical update input from a provider adapter.
 * @returns         The updated canonical MatchResult DTO.
 * @throws MatchResultError  On validation failures or missing / cross-tenant events.
 */
export async function updateMatchResult(
  database: MatchResultDatabase,
  input: UpdateMatchResultInput,
): Promise<MatchResult> {
  const event = await loadMatchEvent(database, input.matchId, input.tenantId);

  if (event === null) {
    // Could be missing or cross-tenant — report as not found
    throw matchNotFound(input.matchId);
  }

  if (event.tenantId !== input.tenantId) {
    throw tenantMismatch(input.matchId, input.tenantId);
  }

  const warnings = validateMatchResult(input, event);

  const targetStatus = input.status ?? resolveCanonicalStatus(event.status);
  const mapping = event.matchExternalMapping;

  // Resolve final score: prefer input values, fall back to existing mapping values
  const homeGoals =
    input.homeGoals !== undefined
      ? input.homeGoals
      : (mapping?.scoreHome ?? null);
  const awayGoals =
    input.awayGoals !== undefined
      ? input.awayGoals
      : (mapping?.scoreAway ?? null);

  // Build display label for terminal scoreable states
  const resultLabel =
    isTerminalStatus(targetStatus) && isScoreableStatus(targetStatus)
      ? buildResultLabel(homeGoals, awayGoals)
      : null;

  const syncedAt = new Date();

  const before = toMatchResult(event);

  const updated = await persistMatchResult(database, {
    eventId: event.id,
    status: targetStatus,
    homeGoals,
    awayGoals,
    resultLabel,
    providerState: input.providerState ?? (mapping?.providerMatchState ?? null),
    providerStateLabel:
      input.providerStateLabel ?? (mapping?.providerMatchStateName ?? null),
    mappingId: mapping?.id ?? null,
    syncedAt,
  });

  const result = toMatchResult(updated, warnings);

  void recordResultAudit(database, {
    eventId: event.id,
    action: "RESULT_UPDATED",
    provider: input.provider,
    before,
    after: result,
  });

  return result;
}

/**
 * Resolve the canonical MatchStatus for a match without mutating it.
 *
 * Convenience wrapper around resolveCanonicalStatus. Loads the event to
 * validate existence and tenant membership.
 *
 * @throws MatchResultError  When the event is not found or cross-tenant.
 */
export async function resolveMatchStatus(
  database: MatchResultDatabase,
  matchId: string,
  tenantId: string,
): Promise<MatchStatus> {
  const event = await loadMatchEvent(database, matchId, tenantId);

  if (event === null) {
    throw matchNotFound(matchId);
  }

  return resolveCanonicalStatus(event.status);
}

/**
 * Write the canonical display result label to the Event.
 *
 * Called after updateMatchResult() to ensure the label is always in sync.
 * Can also be called independently to repair a missing label.
 *
 * Only writes when scores are available. No-ops for matches without scores.
 *
 * @returns The current MatchResult (with updated resultLabel if written).
 * @throws MatchResultError  When the event is not found or cross-tenant.
 */
export async function publishMatchResult(
  database: MatchResultDatabase,
  input: PublishMatchResultInput,
): Promise<MatchResult> {
  const event = await loadMatchEvent(database, input.matchId, input.tenantId);

  if (event === null) {
    throw matchNotFound(input.matchId);
  }

  const mapping = event.matchExternalMapping;
  const status = resolveCanonicalStatus(event.status);

  const resultLabel =
    isTerminalStatus(status) && isScoreableStatus(status)
      ? buildResultLabel(
          mapping?.scoreHome ?? null,
          mapping?.scoreAway ?? null,
        )
      : null;

  const updated = await persistMatchResult(database, {
    eventId: event.id,
    status,
    homeGoals: mapping?.scoreHome ?? null,
    awayGoals: mapping?.scoreAway ?? null,
    resultLabel,
    providerState: mapping?.providerMatchState ?? null,
    providerStateLabel: mapping?.providerMatchStateName ?? null,
    mappingId: mapping?.id ?? null,
    syncedAt: new Date(),
  });

  return toMatchResult(updated);
}

/**
 * Process a batch of result updates for a single tenant and provider.
 *
 * Failures are captured per item — one failing match does not abort the
 * rest of the batch. This matches the SFV detail-sync error semantics.
 *
 * @param database  Injectable DB port.
 * @param input     Batch input scoped to one tenant + provider.
 * @returns         Aggregated batch outcome.
 */
export async function batchUpdateResults(
  database: MatchResultDatabase,
  input: BatchUpdateResultsInput,
): Promise<BatchUpdateResultsOutput> {
  const items: BatchUpdateResultItem[] = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const update of input.updates) {
    const fullInput: UpdateMatchResultInput = {
      ...update,
      tenantId: input.tenantId,
      provider: input.provider,
    };

    try {
      const before = await loadMatchEvent(
        database,
        update.matchId,
        input.tenantId,
      );

      const result = await updateMatchResult(database, fullInput);

      // Detect whether anything actually changed
      const wasUnchanged =
        before !== null &&
        before.status === toEventStatus(result.status) &&
        (before.matchExternalMapping?.scoreHome ?? null) ===
          result.homeGoals &&
        (before.matchExternalMapping?.scoreAway ?? null) ===
          result.awayGoals;

      if (wasUnchanged) {
        unchanged++;
      } else {
        updated++;
      }

      items.push({
        matchId: update.matchId,
        outcome: wasUnchanged ? "unchanged" : "updated",
        warnings: result.warnings,
      });
    } catch (err) {
      failed++;
      items.push({
        matchId: update.matchId,
        outcome: "failed",
        warnings: [],
        error:
          err instanceof Error
            ? err.message
            : "Unknown error",
      });
    }
  }

  return {
    tenantId: input.tenantId,
    provider: input.provider,
    processed: input.updates.length,
    updated,
    unchanged,
    failed,
    items,
  };
}
