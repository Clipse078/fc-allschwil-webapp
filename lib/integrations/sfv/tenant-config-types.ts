/**
 * lib/integrations/sfv/tenant-config-types.ts
 *
 * Shared TypeScript types for the tenant-scoped SFV integration configuration.
 *
 * These types mirror the TenantSfvConfig Prisma model exactly.
 * They are defined here (not derived from Prisma's generated types) so that
 * the repository, service, and validation layers can import them without
 * depending on Prisma's generated client in contexts where it is not available.
 *
 * Usage:
 *   Import TenantSfvConfig wherever the resolved configuration is consumed.
 *   Import TenantSfvConfigInput for create/update input shapes.
 *
 * Security:
 *   No credential values, bearer tokens, environment variables, or SFV
 *   response payloads are stored in this config. It holds only the structural
 *   identifiers (clubId, defaultSeasonId, organisationId) and a lifecycle flag
 *   (enabled). All lookups must be keyed on tenantId from a trusted session —
 *   never on a caller-supplied clubId.
 */

// ── Domain type ────────────────────────────────────────────────────────────────

/**
 * Resolved SFV integration configuration for one tenant.
 *
 * Mirrors the TenantSfvConfig Prisma model exactly.
 * All integer fields (clubId, defaultSeasonId, organisationId) hold positive
 * integers matching SFV API contract — never strings.
 */
export type TenantSfvConfig = {
  /** Opaque row identifier (cuid). */
  id: string;
  /** Owning tenant identifier. Foreign key to Tenant.id. */
  tenantId: string;
  /**
   * Positive integer SFV club identifier (e.g. 483 for FC Allschwil).
   * Used in all SFV API requests that require a clubId parameter.
   */
  clubId: number;
  /**
   * Positive integer SFV season identifier used as the default when the
   * caller does not supply an explicit seasonId (e.g. 2027 for 2026/2027).
   */
  defaultSeasonId: number;
  /**
   * Optional SFV organisation identifier.
   * Null when not assigned by SFV or not required by the integration.
   */
  organisationId: number | null;
  /**
   * When false the SFV integration is administratively disabled.
   * Consumers MUST treat a disabled config as "not configured".
   */
  enabled: boolean;
  /** Most recent fully successful team sync completion time. */
  lastTeamSyncAt: Date | null;
  /** Most recent fully successful schedule sync completion time. */
  lastScheduleSyncAt: Date | null;
  /** Most recent fully successful match-detail sync completion time. */
  lastMatchDetailSyncAt: Date | null;
  /** Most recent fully successful competition sync completion time. */
  lastCompetitionSyncAt: Date | null;
  /**
   * Set while an automatic (cron-triggered) schedule sync is in progress for
   * this tenant; null when idle. TTL-based overlap guard — see
   * claimSfvScheduleSyncLock() in tenant-config-repository.ts. Manual
   * admin-triggered syncs never read or write this field.
   */
  syncLockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * Input shape for creating or updating a TenantSfvConfig.
 *
 * tenantId is NOT part of this type — it is always supplied separately and
 * derived from a trusted session, never from caller-controlled input.
 */
export type TenantSfvConfigInput = {
  /** Positive integer SFV club identifier. */
  clubId: number;
  /** Positive integer SFV season identifier (default season). */
  defaultSeasonId: number;
  /** Optional positive integer SFV organisation identifier. */
  organisationId?: number | null;
  /** Whether the integration is enabled. */
  enabled: boolean;
};

// ── Error types ───────────────────────────────────────────────────────────────

/**
 * Error thrown when no SFV configuration exists for the given tenant.
 *
 * Signals that the tenant has never been configured for SFV integration.
 * Callers should treat this as a "not configured" state and surface an
 * appropriate user-facing message rather than a generic internal error.
 */
export class SfvTenantConfigNotFoundError extends Error {
  readonly tenantId: string;

  constructor(tenantId: string) {
    super(`No SFV configuration found for tenant "${tenantId}".`);
    this.name = "SfvTenantConfigNotFoundError";
    this.tenantId = tenantId;
  }
}

/**
 * Error thrown when an SFV configuration exists for the tenant but is disabled.
 *
 * Signals that the configuration row is present but the integration has been
 * administratively disabled (enabled = false). Callers should treat this as
 * "intentionally inactive" — distinct from "not configured".
 */
export class SfvTenantConfigDisabledError extends Error {
  readonly tenantId: string;

  constructor(tenantId: string) {
    super(`SFV integration is disabled for tenant "${tenantId}".`);
    this.name = "SfvTenantConfigDisabledError";
    this.tenantId = tenantId;
  }
}

/**
 * Error thrown when a TenantSfvConfigInput fails validation.
 *
 * Provides a human-readable message describing which field failed and why.
 * Never includes credential values or environment variable names.
 */
export class SfvTenantConfigValidationError extends Error {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(`Invalid SFV configuration: ${field} — ${reason}`);
    this.name = "SfvTenantConfigValidationError";
    this.field = field;
  }
}
