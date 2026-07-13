/**
 * lib/integrations/sfv/sync/detail.ts
 *
 * SFV match-detail synchronization — main orchestrator (Slice 3C).
 *
 * Iterates over all MatchExternalMapping rows for a tenant/season, fetches
 * richer match-day data from GET /api/match/{matchId}, and updates a strictly
 * limited set of provider-managed Event fields. NEVER creates Events.
 *
 * Call contract:
 *   - tenantId MUST originate from a trusted session. Never accept from
 *     caller-supplied request body.
 *   - Requires an enabled TenantSfvConfig. Throws if not configured/disabled.
 *   - NEVER creates, deactivates, or deletes Events or MatchExternalMappings.
 *   - Provider failure for a single match is recorded and execution continues.
 *   - Provider failure causes no database mutation for that match.
 *
 * Architecture invariants:
 *   - No duplicated authentication logic — delegates to acquireToken().
 *   - No client-side provider calls — runs server-side only.
 *   - Tenant context required for every operation.
 *   - Structured and typed result — safe to serialize to JSON.
 *   - Safe error handling — no credentials or raw payloads leak.
 *   - Idempotent — running twice produces identical DB state (only
 *     detailSyncedAt may differ).
 *   - Club-managed fields are NEVER written:
 *       title, remarks, meetingTime, pitchCode, homeDressingRoomCode,
 *       awayDressingRoomCode, websiteVisible, infoboardVisible,
 *       wochenplanVisible, homepageVisible, trainingsplanVisible,
 *       teamPageVisible, sortOrder, reviewStage, reviewNotes, teamId,
 *       seasonId, opponentName, resultLabel, homeAway
 *   - Provider-managed fields written on change:
 *       startAt, status, location, competitionLabel, intermediateResultLabel
 *
 * Security invariants:
 *   - No secrets in errors or logs.
 *   - No raw provider payloads in the result.
 *   - All DB queries are scoped to tenantId.
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import { fetchMatchDetail } from "../client";
import { toSafePublicError } from "../errors";
import type { SfvDetailSyncContext, SfvDetailSyncResult } from "./detail-types";
import type { SyncErrorEntry } from "./types";
import {
  loadMappingsForDetailSync,
  detectDetailChanges,
  applyDetailUpdate,
  stampDetailSyncedAt,
} from "./detail-persistence";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER = "SFV";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs a full tenant-scoped SFV match-detail synchronization.
 *
 * Iterates over all MatchExternalMapping rows for the tenant/season and
 * enriches each linked Event with provider-managed detail data. The set of
 * updated fields is strictly limited to provider-managed fields. Club-managed
 * fields are guaranteed to remain unchanged.
 *
 * This function NEVER creates Events. Only existing Events linked through
 * MatchExternalMapping are processed. This invariant must be preserved in
 * every future modification.
 *
 * @param tenantId  Trusted session-derived tenant identifier.
 * @returns         Typed, sanitized sync result safe to return from an API route.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function syncSfvMatchDetails(tenantId: string): Promise<SfvDetailSyncResult> {
  const startedAt = new Date();

  // Resolve tenant config — throws if not configured or disabled
  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  const context: SfvDetailSyncContext = {
    tenantId,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    syncedAt: startedAt,
  };

  // ── Load all existing mappings for this tenant/season ────────────────────

  const mappings = await loadMappingsForDetailSync(
    tenantId,
    PROVIDER,
    context.seasonId,
  );

  // ── Process each mapping ─────────────────────────────────────────────────

  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const errors: SyncErrorEntry[] = [];

  for (const mapping of mappings) {
    // Fetch detail from provider
    let detail: Awaited<ReturnType<typeof fetchMatchDetail>>;

    try {
      detail = await fetchMatchDetail(mapping.externalMatchId);
    } catch (fetchError) {
      failed++;
      const safe = toSafePublicError(fetchError);
      errors.push({
        code: safe.code,
        message: `Match detail fetch failed for externalMatchId ${mapping.externalMatchId}: ${safe.message}`,
        externalTeamId: undefined,
      });
      continue;
    }

    // Detect changes (provider-managed fields only)
    const hasChanges = detectDetailChanges(mapping.event, detail);

    let outcome;
    if (hasChanges) {
      outcome = await applyDetailUpdate(mapping, detail, context);
    } else {
      outcome = await stampDetailSyncedAt(mapping.id, context.syncedAt);
    }

    switch (outcome.status) {
      case "updated":
        updated++;
        break;
      case "unchanged":
        unchanged++;
        break;
      case "failed":
        failed++;
        errors.push({ code: outcome.code, message: outcome.message });
        break;
    }
  }

  // ── Build and return result ──────────────────────────────────────────────

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantId,
    source: PROVIDER,
    processed: mappings.length,
    updated,
    unchanged,
    failed,
    errors,
  };
}
