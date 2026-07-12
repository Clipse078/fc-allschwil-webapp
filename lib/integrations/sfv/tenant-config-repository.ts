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
