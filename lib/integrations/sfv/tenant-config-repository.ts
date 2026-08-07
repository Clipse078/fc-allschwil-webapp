/**
 * lib/integrations/sfv/tenant-config-repository.ts
 *
 * Prisma-backed repository for TenantSfvConfig.
 *
 * Provides read and write access to the tenant-scoped SFV integration
 * configuration. All lookups and mutations are keyed on tenantId — never on
 * caller-supplied clubId values.
 *
 * Architecture invariants:
 *   - Failures from Prisma are not swallowed — callers handle DB errors.
 *   - Returns null when no row exists (not an error; tenant may be unconfigured).
 *   - The select projection is explicit: no internal Prisma fields leak out.
 *
 * Security invariant:
 *   All queries are scoped to a single tenantId. Tenant A cannot retrieve or
 *   modify Tenant B's configuration because tenantId is always taken from a
 *   trusted session context, never from caller-provided input.
 */

import { prisma } from "@/lib/db/prisma";
import type { TenantSfvConfig, TenantSfvConfigInput } from "./tenant-config-types";

const sfvConfigSelect = {
  id: true,
  tenantId: true,
  clubId: true,
  defaultSeasonId: true,
  organisationId: true,
  enabled: true,
  lastTeamSyncAt: true,
  lastScheduleSyncAt: true,
  lastMatchDetailSyncAt: true,
  lastCompetitionSyncAt: true,
  syncLockedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Returns the SFV configuration for the given tenant, or null when none exists.
 *
 * Does NOT filter by enabled — returns the row regardless of the enabled flag.
 * Callers that must only proceed when the integration is active should use
 * getEnabledSfvConfigByTenantId() or apply the enabled check in the service.
 */
export async function findSfvConfigByTenantId(
  tenantId: string,
): Promise<TenantSfvConfig | null> {
  return prisma.tenantSfvConfig.findUnique({
    where: { tenantId },
    select: sfvConfigSelect,
  });
}

/**
 * Returns the SFV configuration only when it exists AND is enabled.
 * Returns null when there is no config or when enabled = false.
 *
 * Use this in paths that should silently do nothing when SFV is inactive.
 * Use requireEnabledSfvConfigForTenant() in the service layer for paths
 * that must distinguish between "not configured" and "disabled".
 */
export async function getEnabledSfvConfigByTenantId(
  tenantId: string,
): Promise<TenantSfvConfig | null> {
  return prisma.tenantSfvConfig.findFirst({
    where: { tenantId, enabled: true },
    select: sfvConfigSelect,
  });
}

/**
 * Creates or updates the SFV configuration for the given tenant.
 *
 * Uses Prisma upsert keyed on the unique tenantId constraint.
 * Creates a new row when none exists; overwrites all mutable fields when one
 * does. The tenantId is always provided by the caller — never derived from
 * the input payload.
 *
 * Returns the persisted config after the upsert.
 */
export async function upsertSfvConfigByTenantId(
  tenantId: string,
  input: TenantSfvConfigInput,
): Promise<TenantSfvConfig> {
  const fields = {
    clubId: input.clubId,
    defaultSeasonId: input.defaultSeasonId,
    organisationId: input.organisationId ?? null,
    enabled: input.enabled,
  };

  return prisma.tenantSfvConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...fields },
    update: fields,
    select: sfvConfigSelect,
  });
}

/**
 * Records completion of the most recent fully successful team synchronization.
 */
export async function markTeamSyncSuccessful(
  tenantId: string,
  finishedAt: Date,
): Promise<void> {
  await prisma.tenantSfvConfig.update({
    where: { tenantId },
    data: { lastTeamSyncAt: finishedAt },
  });
}

/**
 * Records completion of the most recent fully successful schedule synchronization.
 */
export async function markScheduleSyncSuccessful(
  tenantId: string,
  finishedAt: Date,
): Promise<void> {
  await prisma.tenantSfvConfig.update({
    where: { tenantId },
    data: { lastScheduleSyncAt: finishedAt },
  });
}

/**
 * Records completion of the most recent fully successful match-detail synchronization.
 */
export async function markMatchDetailSyncSuccessful(
  tenantId: string,
  finishedAt: Date,
): Promise<void> {
  await prisma.tenantSfvConfig.update({
    where: { tenantId },
    data: { lastMatchDetailSyncAt: finishedAt },
  });
}

/**
 * Records completion of the most recent fully successful competition synchronization.
 */
export async function markCompetitionSyncSuccessful(
  tenantId: string,
  finishedAt: Date,
): Promise<void> {
  await prisma.tenantSfvConfig.update({
    where: { tenantId },
    data: { lastCompetitionSyncAt: finishedAt },
  });
}

// ── Automatic (cron) sync support — SFV-MATCH-SYNC-HOTFIX-01 ─────────────────

/**
 * Returns the tenantId of every tenant with an enabled SFV configuration.
 *
 * Used exclusively by the automatic (cron-triggered) sync orchestrator to
 * discover which tenants require a scheduled sync run. Never used to bypass
 * the enabled/disabled check — only enabled tenants are returned.
 */
export async function listEnabledSfvConfigTenantIds(): Promise<string[]> {
  const rows = await prisma.tenantSfvConfig.findMany({
    where: { enabled: true },
    select: { tenantId: true },
  });
  return rows.map((row) => row.tenantId);
}

/**
 * Atomically claims the automatic-sync lock for one tenant.
 *
 * Implemented as a single conditional UPDATE — safe under Postgres's default
 * READ COMMITTED isolation: if two invocations race to claim the same
 * tenant, only one UPDATE will match the WHERE clause (the other blocks on
 * the row lock, then re-evaluates the WHERE clause against the just-committed
 * row and finds syncLockedAt no longer satisfies the condition). No advisory
 * locks or explicit transactions are required.
 *
 * The lock is considered free when `syncLockedAt` is null OR older than
 * `staleAfterMs` (self-healing: a crashed/killed function run can never
 * permanently wedge a tenant out of future automatic syncs).
 *
 * Returns true when the lock was claimed by this call (caller must run the
 * sync and then call releaseSfvScheduleSyncLock() in a finally block).
 * Returns false when another run currently holds a fresh lock — the caller
 * must skip this tenant for this invocation.
 */
export async function claimSfvScheduleSyncLock(
  tenantId: string,
  now: Date,
  staleAfterMs: number,
): Promise<boolean> {
  const staleThreshold = new Date(now.getTime() - staleAfterMs);

  const result = await prisma.tenantSfvConfig.updateMany({
    where: {
      tenantId,
      enabled: true,
      OR: [{ syncLockedAt: null }, { syncLockedAt: { lt: staleThreshold } }],
    },
    data: { syncLockedAt: now },
  });

  return result.count === 1;
}

/**
 * Releases the automatic-sync lock for one tenant.
 *
 * Must be called in a finally block after claimSfvScheduleSyncLock() returns
 * true, regardless of whether the sync succeeded or failed, so a single
 * tenant failure can never block that tenant's future automatic sync runs.
 */
export async function releaseSfvScheduleSyncLock(tenantId: string): Promise<void> {
  await prisma.tenantSfvConfig.update({
    where: { tenantId },
    data: { syncLockedAt: null },
  });
}
