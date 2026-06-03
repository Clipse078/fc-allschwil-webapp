/**
 * Tenant Runtime Context — Slice 10.3
 *
 * Provides a unified, typed tenant context object for server-side code.
 * Includes all config fields (countryCode, locale, timezone, currency, season)
 * so formatting and season helpers can operate without re-querying the DB.
 *
 * Usage:
 *   const ctx = await getCurrentTenantContext();   // null if not found
 *   const ctx = await requireCurrentTenantContext(); // throws if not found
 *
 * Design:
 * - Keeps a lightweight DB select (no _count, no relations).
 * - String config fields are nullable: callers must handle null gracefully.
 * - Season integer fields are NOT NULL — always present with a structural default.
 * - Does NOT modify the existing requireTenant() / getDefaultTenant() helpers,
 *   which remain in place for code that only needs identity fields.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";

const tenantContextSelect = {
  id: true,
  key: true,
  name: true,
  status: true,
  countryCode: true,
  sportCategory: true,
  locale: true,
  timezone: true,
  currency: true,
  seasonStartMonth: true,
  seasonTransitionDay: true,
  seasonTransitionMonth: true,
} as const;

export type TenantContext = {
  id: string;
  key: string;
  name: string;
  status: string;
  // Nullable: must be configured by a platform admin before use.
  countryCode: string | null;
  sportCategory: string | null;
  locale: string | null;
  timezone: string | null;
  currency: string | null;
  // NOT NULL: structural scheduling fields (August 1 default).
  seasonStartMonth: number;
  seasonTransitionDay: number;
  seasonTransitionMonth: number;
};

/**
 * Returns the full TenantContext for the given tenant key, or null if the
 * tenant does not exist or is not ACTIVE. Failures are swallowed — callers
 * that require a context should use requireCurrentTenantContext() instead.
 */
export async function getCurrentTenantContext(
  key: string = DEFAULT_TENANT_KEY,
): Promise<TenantContext | null> {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { key, status: "ACTIVE" },
      select: tenantContextSelect,
    });
    return tenant ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the full TenantContext for the given tenant key.
 * Throws a descriptive error if the tenant is not found or not ACTIVE.
 * Use in server components and API routes that cannot proceed without a context.
 */
export async function requireCurrentTenantContext(
  key: string = DEFAULT_TENANT_KEY,
): Promise<TenantContext> {
  const ctx = await getCurrentTenantContext(key);
  if (!ctx) {
    throw new Error(
      `Active tenant context not found: "${key}". ` +
        `Ensure prisma migrate deploy and seed have run on this environment.`,
    );
  }
  return ctx;
}
