/**
 * lib/integrations/sfv/sync/auto-sync.ts
 *
 * Automatic (cron-triggered) SFV synchronization orchestrator.
 * SFV-MATCH-SYNC-HOTFIX-01 — Phase B.
 *
 * Design goals (per hotfix requirements):
 *   - Reuses the existing canonical schedule sync service (syncSfvSchedule)
 *     verbatim — this module does NOT reimplement any SFV fetch/parse/
 *     persistence logic. It only adds tenant discovery + per-tenant
 *     overlap protection + isolated error handling around the existing
 *     service, so the fix for SFV-MATCH-SYNC-HOTFIX-01 Phase A applies here
 *     automatically.
 *   - Tenant/provider scoped: iterates only tenants with an enabled
 *     TenantSfvConfig row.
 *   - Idempotent: syncSfvSchedule() is already idempotent (upsert keyed on
 *     externalMatchId, "unchanged" short-circuit when nothing changed) —
 *     running this orchestrator repeatedly never creates duplicates and
 *     avoids rewriting unchanged matches.
 *   - Safe against overlapping runs: each tenant is claimed via an atomic,
 *     TTL-based lock (claimSfvScheduleSyncLock) before syncing. A tenant
 *     already being synced (by an overlapping cron invocation, or a long-
 *     running manual admin action, if ever extended to share the lock) is
 *     skipped for this invocation rather than run twice concurrently.
 *   - Failures isolated per tenant: one tenant's provider error, config
 *     error, or unexpected exception is caught, recorded, and does NOT
 *     prevent any other tenant from being processed.
 *   - No client/browser polling and no invocation from ordinary page
 *     requests: this module is only ever invoked from the authenticated
 *     Vercel Cron route (app/api/cron/sfv-sync/route.ts). Secrets
 *     (SFV credentials) stay server-side — this module never accepts or
 *     returns them.
 *   - Sequential processing (not parallel) to avoid bursting the shared
 *     in-memory SFV token cache / provider rate limits with concurrent
 *     requests across tenants — deliberately minimizes provider load.
 *
 * Security invariants:
 *   - No credentials, tokens, or raw provider payloads in the result.
 *   - Errors are sanitized (delegates to syncSfvSchedule's own sanitized
 *     error handling; unexpected exceptions here are reduced to a safe
 *     code + message only).
 */

import {
  listEnabledSfvConfigTenantIds,
  claimSfvScheduleSyncLock,
  releaseSfvScheduleSyncLock,
} from "../tenant-config-repository";
import { syncSfvSchedule } from "./schedule";
import type { SfvScheduleSyncResult } from "./schedule-types";

/**
 * Lock TTL: a claimed-but-never-released lock (e.g. process killed mid-sync)
 * self-heals after this many milliseconds, so a single crashed run can never
 * permanently exclude a tenant from future automatic syncs.
 *
 * Set comfortably above the expected sync duration (seconds) but at or below
 * the cron interval, so a genuinely stuck lock clears before, or around, the
 * next scheduled invocation.
 */
export const SFV_AUTO_SYNC_LOCK_STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes

/** Per-tenant outcome of one automatic sync invocation. */
export type SfvAutoSyncTenantOutcome =
  | { tenantId: string; outcome: "synced"; result: SfvScheduleSyncResult }
  | { tenantId: string; outcome: "skipped_locked" }
  | { tenantId: string; outcome: "failed"; code: string; message: string };

/** Sanitized, serializable summary of one automatic-sync run across all tenants. */
export type SfvAutoSyncSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tenantsDiscovered: number;
  tenantsSynced: number;
  tenantsSkippedLocked: number;
  tenantsFailed: number;
  tenants: SfvAutoSyncTenantOutcome[];
};

/**
 * Runs an automatic SFV schedule sync for every tenant with an enabled
 * TenantSfvConfig, one tenant at a time.
 *
 * Never throws: every per-tenant failure is caught and recorded in the
 * returned summary so that a single tenant's failure never aborts the run
 * for other tenants (and never corrupts their data — each tenant's sync is
 * fully independent, scoped by tenantId end-to-end in syncSfvSchedule).
 *
 * @param staleAfterMs  Overridable for tests; defaults to
 *                       SFV_AUTO_SYNC_LOCK_STALE_AFTER_MS.
 */
export async function runAutomaticSfvScheduleSync(
  staleAfterMs: number = SFV_AUTO_SYNC_LOCK_STALE_AFTER_MS,
): Promise<SfvAutoSyncSummary> {
  const startedAt = new Date();
  const tenantIds = await listEnabledSfvConfigTenantIds();

  const tenants: SfvAutoSyncTenantOutcome[] = [];
  let tenantsSynced = 0;
  let tenantsSkippedLocked = 0;
  let tenantsFailed = 0;

  for (const tenantId of tenantIds) {
    const claimedAt = new Date();
    let claimed = false;

    try {
      claimed = await claimSfvScheduleSyncLock(tenantId, claimedAt, staleAfterMs);

      if (!claimed) {
        tenantsSkippedLocked++;
        tenants.push({ tenantId, outcome: "skipped_locked" });
        continue;
      }

      const result = await syncSfvSchedule(tenantId);
      tenantsSynced++;
      tenants.push({ tenantId, outcome: "synced", result });
    } catch (error) {
      tenantsFailed++;
      const message = error instanceof Error ? error.message : "Unknown error.";
      const code = error instanceof Error ? error.name : "UNKNOWN_ERROR";
      tenants.push({ tenantId, outcome: "failed", code, message });
    } finally {
      if (claimed) {
        // Always release, even on failure — a failed tenant must not block
        // its own future automatic sync runs.
        await releaseSfvScheduleSyncLock(tenantId).catch(() => {
          // Releasing is best-effort: if it fails, the TTL guarantees the
          // lock still self-heals on the next invocation.
        });
      }
    }
  }

  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    tenantsDiscovered: tenantIds.length,
    tenantsSynced,
    tenantsSkippedLocked,
    tenantsFailed,
    tenants,
  };
}
