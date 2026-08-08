/**
 * lib/integrations/sfv/sync/auto-club-master-import.ts
 *
 * CLUB-DIRECTORY-05-C1 — Automatic (cron-triggered) SFV club master import
 * orchestrator.
 *
 * Product decision: tenant admins must not trigger the SFV club master
 * import manually. It now runs automatically, once per day, for every
 * tenant with an enabled TenantSfvConfig — the exact same operational
 * pattern already established for the SFV match/schedule sync
 * (runAutomaticSfvScheduleSync in ./auto-sync.ts).
 *
 * Design goals (mirrors auto-sync.ts):
 *   - Reuses the existing canonical club master import service
 *     (runSfvClubMasterImport) verbatim — this module does NOT reimplement
 *     any SFV fetch/parse/persistence/identity-resolution logic. It only
 *     adds tenant discovery + isolated per-tenant error handling around the
 *     existing service.
 *   - Tenant/provider scoped: iterates only tenants with an enabled
 *     TenantSfvConfig row, via the same listEnabledSfvConfigTenantIds()
 *     used by the match-sync orchestrator — no new tenant-discovery query.
 *   - Idempotent: runSfvClubMasterImport() is already idempotent (resolve-
 *     or-create keyed on providerClubId, never overwriting tenant-managed
 *     fields) — running this orchestrator repeatedly never creates
 *     duplicate clubs.
 *   - Failures isolated per tenant: one tenant's provider error, config
 *     error, or unexpected exception is caught, recorded, and does NOT
 *     prevent any other tenant from being processed, and never corrupts
 *     any other tenant's already-persisted data (tenantId-scoped writes
 *     throughout, exactly as CLUB-DIRECTORY-05 already established).
 *   - Deliberately independent of the match/schedule sync cron: this
 *     orchestrator is invoked from its own dedicated cron route
 *     (app/api/cron/sfv-club-master-import/route.ts) on its own daily
 *     schedule — never called from, or coupled to, runAutomaticSfvScheduleSync
 *     or the match-sync cron route. A tenant with SFV disabled, or a
 *     tenant's schedule-sync failure, has no bearing on this run.
 *   - Sequential processing (not parallel) — same rationale as
 *     runAutomaticSfvScheduleSync: avoids bursting the shared SFV
 *     token cache / provider rate limits with concurrent requests.
 *   - No new scheduling framework: reuses the existing cron-route +
 *     CRON_SECRET pattern verbatim.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in the result.
 *   - Unexpected per-tenant exceptions are reduced to a safe code + message
 *     only (never a raw error object or stack trace).
 */

import { listEnabledSfvConfigTenantIds } from "../tenant-config-repository";
import { runSfvClubMasterImport } from "./club-master-import";
import type { SfvClubMasterImportResult } from "./club-master-import";

/** Per-tenant outcome of one automatic club master import invocation. */
export type SfvAutoClubMasterImportTenantOutcome =
  | { tenantId: string; outcome: "synced"; result: SfvClubMasterImportResult }
  | { tenantId: string; outcome: "failed"; code: string; message: string };

/** Sanitized, serializable summary of one automatic club master import run across all tenants. */
export type SfvAutoClubMasterImportSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tenantsDiscovered: number;
  tenantsSynced: number;
  tenantsFailed: number;
  tenants: SfvAutoClubMasterImportTenantOutcome[];
};

/**
 * Runs an automatic SFV club master import for every tenant with an enabled
 * TenantSfvConfig, one tenant at a time.
 *
 * Never throws: every per-tenant failure is caught and recorded in the
 * returned summary so that a single tenant's failure never aborts the run
 * for other tenants.
 */
export async function runAutomaticSfvClubMasterImport(): Promise<SfvAutoClubMasterImportSummary> {
  const startedAt = new Date();
  const tenantIds = await listEnabledSfvConfigTenantIds();

  const tenants: SfvAutoClubMasterImportTenantOutcome[] = [];
  let tenantsSynced = 0;
  let tenantsFailed = 0;

  for (const tenantId of tenantIds) {
    try {
      const result = await runSfvClubMasterImport(tenantId);
      tenantsSynced++;
      tenants.push({ tenantId, outcome: "synced", result });
    } catch (error) {
      tenantsFailed++;
      const message = error instanceof Error ? error.message : "Unknown error.";
      const code = error instanceof Error ? error.name : "UNKNOWN_ERROR";
      tenants.push({ tenantId, outcome: "failed", code, message });
    }
  }

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantsDiscovered: tenantIds.length,
    tenantsSynced,
    tenantsFailed,
    tenants,
  };
}
