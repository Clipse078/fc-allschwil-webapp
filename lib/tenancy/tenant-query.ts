/**
 * tenant-query.ts
 *
 * Prisma query helpers for tenant-scoped data access.
 *
 * Phase 3 strategy — OR filter instead of hard filter:
 *
 *   { OR: [{ tenantId: activeTenantId }, { tenantId: null }] }
 *
 * This intentionally includes rows where tenantId IS NULL so that legacy
 * rows (pre-backfill) remain visible during the transition.  Once all rows
 * have been backfilled (via npm run backfill:tenant:fca) the null arm of the
 * OR will simply never match, effectively becoming a hard tenant filter.
 *
 * Phase 4 will tighten this to a strict equality filter and make tenantId
 * required on all models.
 */

import { auth } from "@/auth";
import { getDefaultTenant } from "@/lib/tenancy/get-default-tenant";

// ---------------------------------------------------------------------------
// tenantWhere — building block for Prisma `where` clauses
// ---------------------------------------------------------------------------

/**
 * Returns a Prisma `where` fragment that matches rows belonging to the given
 * tenant OR rows where tenantId is still NULL (legacy / pre-backfill rows).
 *
 * Returns an empty object `{}` when no tenantId is provided, which means
 * "no tenant filter" — every row is returned.  This preserves backward
 * compatibility when tenant context is not yet available.
 *
 * Usage:
 *   prisma.season.findMany({ where: tenantWhere(activeTenantId), ... })
 */
export function tenantWhere(activeTenantId: string | null | undefined) {
  if (!activeTenantId) {
    return {};
  }

  return {
    OR: [
      { tenantId: activeTenantId },
      { tenantId: null as null },
    ],
  };
}

// ---------------------------------------------------------------------------
// requireTenantIdFromSession — server-side helper for API routes / RSCs
// ---------------------------------------------------------------------------

/**
 * Reads activeTenantId from the current NextAuth session.
 * Falls back to querying the fc-allschwil tenant from the DB.
 * Returns null if nothing can be resolved (pre-seed state).
 *
 * Wraps errors so the caller never crashes if the Tenant table
 * doesn't exist yet.
 */
export async function requireTenantIdFromSession(): Promise<string | null> {
  try {
    const session = await auth();

    if (session?.user?.activeTenantId) {
      return session.user.activeTenantId;
    }

    // Session has no tenant context — fall back to the default tenant
    const fallback = await getDefaultTenant();
    return fallback?.id ?? null;
  } catch {
    return null;
  }
}
