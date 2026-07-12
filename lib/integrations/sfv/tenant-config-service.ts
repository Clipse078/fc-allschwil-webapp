/**
 * lib/integrations/sfv/tenant-config-service.ts
 *
 * Domain service for tenant-scoped SFV integration configuration.
 *
 * This is the single source of truth for resolving SFV configuration from a
 * tenant context. All future services that need a clubId, defaultSeasonId, or
 * organisationId for SFV API calls MUST go through this service — never through
 * caller-supplied request parameters.
 *
 * Architecture invariants:
 *   - Stateless: no side effects, no caching, no process-wide state.
 *   - Read-only in this slice: no mutations.
 *   - Distinguishes between "not configured" and "disabled":
 *       SfvTenantConfigNotFoundError — no TenantSfvConfig row for this tenant.
 *       SfvTenantConfigDisabledError — row exists but enabled = false.
 *   - tenantId always originates from a trusted session — never from request body.
 *
 * Security invariant:
 *   Tenant A cannot obtain Tenant B's clubId because all resolution goes through
 *   tenantId, which is session-carried and validated by the authentication layer.
 *   The repository is the enforcement point: findSfvConfigByTenantId() is keyed
 *   on tenantId only.
 *
 * Future diagnostics integration:
 *   When the diagnostics route is migrated off caller-supplied clubId, it will:
 *     1. Extract tenantId from the authenticated session (already available).
 *     2. Call requireEnabledSfvConfigForTenant(tenantId).
 *     3. Use config.clubId and config.defaultSeasonId in runSfvAdminDiagnostics().
 *   The caller-supplied clubId in the current route body will be removed.
 *   See: app/api/admin/integrations/sfv/diagnostics/route.ts (steps 3–5).
 */

import {
  findSfvConfigByTenantId,
  getEnabledSfvConfigByTenantId,
} from "./tenant-config-repository";
import {
  type TenantSfvConfig,
  SfvTenantConfigNotFoundError,
  SfvTenantConfigDisabledError,
} from "./tenant-config-types";

// ── Public service functions ───────────────────────────────────────────────────

/**
 * Returns the SFV configuration for the given tenant, or null when no
 * configuration row exists.
 *
 * Does NOT filter by enabled — returns the row regardless of enabled state.
 * Suitable for admin UIs that need to display the configuration even when
 * the integration is disabled.
 *
 * Returns null (does not throw) when no config exists.
 */
export async function getSfvConfigForTenant(
  tenantId: string,
): Promise<TenantSfvConfig | null> {
  return findSfvConfigByTenantId(tenantId);
}

/**
 * Returns the enabled SFV configuration for the given tenant.
 *
 * Throws SfvTenantConfigNotFoundError when no configuration row exists.
 * Throws SfvTenantConfigDisabledError when the configuration exists but is
 * disabled (enabled = false).
 *
 * Use in all service paths that must have an active SFV configuration to proceed.
 * The caller receives a fully typed TenantSfvConfig and can access clubId,
 * defaultSeasonId, and organisationId without additional resolution steps.
 *
 * @throws {SfvTenantConfigNotFoundError} — no config for this tenant
 * @throws {SfvTenantConfigDisabledError} — config exists but is disabled
 */
export async function requireEnabledSfvConfigForTenant(
  tenantId: string,
): Promise<TenantSfvConfig> {
  const config = await findSfvConfigByTenantId(tenantId);

  if (config === null) {
    throw new SfvTenantConfigNotFoundError(tenantId);
  }

  if (!config.enabled) {
    throw new SfvTenantConfigDisabledError(tenantId);
  }

  return config;
}

/**
 * Resolves the SFV clubId for the given tenant from the persisted configuration.
 *
 * This is the canonical server-side lookup that future services should use
 * instead of accepting caller-supplied clubId values. It ensures that the
 * clubId is always the one the platform administrator configured — not whatever
 * the client sends in the request body.
 *
 * @throws {SfvTenantConfigNotFoundError} — no config for this tenant
 * @throws {SfvTenantConfigDisabledError} — integration is disabled
 */
export async function resolveSfvClubId(tenantId: string): Promise<number> {
  const config = await requireEnabledSfvConfigForTenant(tenantId);
  return config.clubId;
}

/**
 * Resolves the SFV defaultSeasonId for the given tenant.
 *
 * Use when the caller does not supply an explicit seasonId and the request
 * should fall back to the tenant-configured default season.
 *
 * @throws {SfvTenantConfigNotFoundError} — no config for this tenant
 * @throws {SfvTenantConfigDisabledError} — integration is disabled
 */
export async function resolveSfvDefaultSeasonId(tenantId: string): Promise<number> {
  const config = await requireEnabledSfvConfigForTenant(tenantId);
  return config.defaultSeasonId;
}

/**
 * Returns true when an enabled SFV integration exists for the given tenant.
 *
 * Never throws. Suitable for feature-flag guards, dashboard badges, and
 * lightweight capability checks that do not need the full config object.
 */
export async function isSfvEnabledForTenant(tenantId: string): Promise<boolean> {
  const config = await getEnabledSfvConfigByTenantId(tenantId);
  return config !== null;
}
