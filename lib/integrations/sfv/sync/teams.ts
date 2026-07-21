/**
 * lib/integrations/sfv/sync/teams.ts
 *
 * SFV team synchronization — main orchestrator.
 *
 * Implements a full, idempotent synchronization of SFV teams for a single
 * tenant. Fetches the team list from the SFV API, compares against existing
 * mappings in the database, and creates or updates records as needed.
 *
 * Call contract:
 *   - tenantId MUST originate from a trusted session. Never accept from a
 *     caller-supplied request body.
 *   - Requires an enabled TenantSfvConfig. Throws if not configured or disabled.
 *   - Never deletes. Teams absent from the provider are only marked inactive
 *     when the full list was confidently received.
 *
 * Architecture invariants:
 *   - No duplicated authentication logic — delegates to existing acquireToken().
 *   - No client-side provider calls — runs server-side only.
 *   - Tenant context required for every operation.
 *   - Structured and typed result — safe to serialize to JSON.
 *   - Safe error handling — errors do not leak credentials or raw payloads.
 *   - Idempotent — running twice produces identical DB state.
 *   - Transactions used in createTeamWithMapping (atomic Team + mapping).
 *
 * Security invariants:
 *   - No secrets in errors or logs.
 *   - No raw provider payloads in the result.
 *   - All DB queries are scoped to tenantId.
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import { markTeamSyncSuccessful } from "../tenant-config-repository";
import { fetchTeamList } from "../client";
import { toSafePublicError } from "../errors";
import type { SfvTeamSyncContext, SfvTeamSyncResult } from "./types";
import {
  loadExistingMappings,
  processTeamDetail,
  markMappingsInactive,
} from "./team-persistence";
import {
  logSyncStarted,
  logSyncCompleted,
  logSyncFailed,
  logTeamPersistenceFailed,
} from "./logging";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER = "SFV";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs a full tenant-scoped SFV team synchronization.
 *
 * @param tenantId  Trusted session-derived tenant identifier. Never supply
 *                  from caller input without authorization.
 * @returns         Typed, sanitized sync result safe to return from an API route.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function syncSfvTeams(tenantId: string): Promise<SfvTeamSyncResult> {
  const startedAt = new Date();

  // Resolve tenant config — throws if not configured or disabled.
  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  const context: SfvTeamSyncContext = {
    tenantId,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    organisationId: tenantConfig.organisationId,
    syncedAt: startedAt,
  };

  logSyncStarted(context);

  // ── Fetch provider data ──────────────────────────────────────────────────

  let providerTeams: Awaited<ReturnType<typeof fetchTeamList>>;
  let fetchSucceeded = false;

  try {
    providerTeams = await fetchTeamList({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null
        ? { OrganisationId: context.organisationId }
        : {}),
    });
    fetchSucceeded = true;
  } catch (fetchError) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const safe = toSafePublicError(fetchError);

    logSyncFailed(context, safe.code, durationMs);

    return buildResult(context, startedAt, finishedAt, {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      markedInactive: 0,
      failed: 1,
      errors: [
        {
          code: safe.code,
          message: `Failed to fetch teams from SFV: ${safe.message}`,
        },
      ],
    });
  }

  // ── Load existing mappings ───────────────────────────────────────────────

  const existingMappings = await loadExistingMappings(
    tenantId,
    PROVIDER,
    context.seasonId,
  );

  // ── Process each provider team ───────────────────────────────────────────

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const errors: SfvTeamSyncResult["errors"] = [];

  // Track which external IDs were present in the provider response.
  const presentExternalIds = new Set<number>();

  for (const teamDetail of providerTeams) {
    presentExternalIds.add(teamDetail.teamId);

    const outcome = await processTeamDetail(teamDetail, context, existingMappings);

    switch (outcome.status) {
      case "created":
        created++;
        break;
      case "updated":
        updated++;
        break;
      case "unchanged":
        unchanged++;
        break;
      case "failed":
        failed++;
        errors.push({
          code: outcome.code,
          message: outcome.message,
          externalTeamId: teamDetail.teamId,
        });
        logTeamPersistenceFailed(tenantId, teamDetail.teamId, outcome.code);
        break;
    }
  }

  // ── Mark absent mappings as inactive ────────────────────────────────────

  // Only safe to mark inactive when the full list was received without errors.
  // A failed fetch or zero-count response after a previously populated season
  // must NOT mark all teams inactive (could be a transient API issue).
  let markedInactive = 0;

  if (fetchSucceeded && providerTeams.length > 0) {
    const absentMappingIds: string[] = [];
    for (const [externalTeamId, mapping] of existingMappings.entries()) {
      if (!presentExternalIds.has(externalTeamId) && mapping.providerIsActive) {
        absentMappingIds.push(mapping.id);
      }
    }

    if (absentMappingIds.length > 0) {
      markedInactive = await markMappingsInactive(absentMappingIds, context.syncedAt);
    }
  }

  // ── Build and return result ──────────────────────────────────────────────

  const finishedAt = new Date();

  const result = buildResult(context, startedAt, finishedAt, {
    fetched: providerTeams.length,
    created,
    updated,
    unchanged,
    markedInactive,
    failed,
    errors,
  });

  logSyncCompleted(result);

  if (result.failed === 0 && result.errors.length === 0) {
    await markTeamSyncSuccessful(tenantId, finishedAt);
  }

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type CountFields = Pick<
  SfvTeamSyncResult,
  "fetched" | "created" | "updated" | "unchanged" | "markedInactive" | "failed" | "errors"
>;

function buildResult(
  context: SfvTeamSyncContext,
  startedAt: Date,
  finishedAt: Date,
  counts: CountFields,
): SfvTeamSyncResult {
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantId: context.tenantId,
    source: PROVIDER,
    clubId: context.clubId,
    seasonId: context.seasonId,
    ...counts,
  };
}
