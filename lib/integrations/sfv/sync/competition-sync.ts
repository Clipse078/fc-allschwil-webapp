/**
 * lib/integrations/sfv/sync/competition-sync.ts
 *
 * SFV competition synchronization — main orchestrator.
 *
 * Extracts competition metadata from the SFV team list response, then
 * creates or updates canonical Competition rows for the tenant.
 *
 * Competitions are derived from the team list (not a dedicated endpoint).
 * Each team's teamLeagueId / teamLeagueName is treated as a competition
 * identifier; unique leagues per season produce one Competition row.
 *
 * Call contract:
 *   - tenantId MUST originate from a trusted session. Never accept from a
 *     caller-supplied request body.
 *   - Requires an enabled TenantSfvConfig. Throws if not configured or disabled.
 *   - Never deletes. Competitions absent from the provider are archived.
 *   - Idempotent: running twice produces identical DB state.
 *
 * Security invariants:
 *   - No secrets in errors or logs.
 *   - No raw provider payloads in the result.
 *   - All DB queries are scoped to tenantId.
 */

import { requireEnabledSfvConfigForTenant } from "../tenant-config-service";
import { markCompetitionSyncSuccessful } from "../tenant-config-repository";
import { fetchTeamList } from "../client";
import { toSafePublicError } from "../errors";
import type { SfvCompetitionSyncResult, SfvCompetitionSyncContext } from "./competition-types";
import { extractCompetitionsFromTeamList } from "./competition-mapper";
import {
  loadExistingCompetitions,
  processCompetition,
  archiveAbsentCompetitions,
} from "./competition-persistence";

// ── Constants ──────────────────────────────────────────────────────────────────

const PROVIDER = "SFV";

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Runs a full tenant-scoped SFV competition synchronization.
 *
 * Fetches the SFV team list (same endpoint as team sync), extracts unique
 * league/competition records, and persists canonical Competition rows.
 *
 * @param tenantId  Trusted session-derived tenant identifier.
 * @returns         Typed, sanitized sync result safe to return from an API route.
 *
 * @throws {SfvTenantConfigNotFoundError}  No TenantSfvConfig for this tenant.
 * @throws {SfvTenantConfigDisabledError}  Integration disabled for this tenant.
 */
export async function syncSfvCompetitions(
  tenantId: string,
): Promise<SfvCompetitionSyncResult> {
  const startedAt = new Date();

  const tenantConfig = await requireEnabledSfvConfigForTenant(tenantId);

  const context: SfvCompetitionSyncContext = {
    tenantId,
    clubId: tenantConfig.clubId,
    seasonId: tenantConfig.defaultSeasonId,
    organisationId: tenantConfig.organisationId,
    syncedAt: startedAt,
  };

  // ── Fetch provider data ──────────────────────────────────────────────────

  let rawTeams: Awaited<ReturnType<typeof fetchTeamList>>;
  let fetchSucceeded = false;

  try {
    rawTeams = await fetchTeamList({
      SeasonId: context.seasonId,
      ClubId: context.clubId,
      ...(context.organisationId !== null
        ? { OrganisationId: context.organisationId }
        : {}),
    });
    fetchSucceeded = true;
  } catch (fetchError) {
    const finishedAt = new Date();
    const safe = toSafePublicError(fetchError);

    return buildResult(context, startedAt, finishedAt, {
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      archived: 0,
      failed: 1,
      errors: [
        {
          code: safe.code,
          message: `Failed to fetch team list from SFV for competition extraction: ${safe.message}`,
        },
      ],
    });
  }

  // ── Extract competitions from team list ──────────────────────────────────

  const extracted = extractCompetitionsFromTeamList(rawTeams, context.seasonId);

  // ── Load existing competition rows ───────────────────────────────────────

  const existingMap = await loadExistingCompetitions(tenantId, context.seasonId);

  // ── Process each extracted competition ──────────────────────────────────

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  const errors: SfvCompetitionSyncResult["errors"] = [];

  const presentIds = new Set<number>();

  for (const competition of extracted) {
    presentIds.add(competition.externalCompetitionId);

    const outcome = await processCompetition(competition, context, existingMap);

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
        errors.push({ code: outcome.code, message: outcome.message });
        break;
    }
  }

  // ── Archive absent competitions ──────────────────────────────────────────

  let archived = 0;

  if (fetchSucceeded && rawTeams.length > 0) {
    const absentIds: string[] = [];
    for (const [externalId, row] of existingMap.entries()) {
      if (!presentIds.has(externalId) && !row.isArchived) {
        absentIds.push(row.id);
      }
    }

    if (absentIds.length > 0) {
      archived = await archiveAbsentCompetitions(absentIds, context.syncedAt);
    }
  }

  // ── Finalize ─────────────────────────────────────────────────────────────

  const finishedAt = new Date();

  const result = buildResult(context, startedAt, finishedAt, {
    fetched: extracted.length,
    created,
    updated,
    unchanged,
    archived,
    failed,
    errors,
  });

  if (result.failed === 0 && result.errors.length === 0) {
    await markCompetitionSyncSuccessful(tenantId, finishedAt);
  }

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type CountFields = Pick<
  SfvCompetitionSyncResult,
  "fetched" | "created" | "updated" | "unchanged" | "archived" | "failed" | "errors"
>;

function buildResult(
  context: SfvCompetitionSyncContext,
  startedAt: Date,
  finishedAt: Date,
  counts: CountFields,
): SfvCompetitionSyncResult {
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
