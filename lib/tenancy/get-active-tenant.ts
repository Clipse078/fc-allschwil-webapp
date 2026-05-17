/**
 * get-active-tenant.ts
 *
 * Server-side helpers for reading tenant context from a NextAuth session.
 * Phase 2 foundation — used by server components and API routes that need
 * to scope queries to the correct tenant.
 *
 * Phase 3 will extend this with a URL-based tenant resolver for multi-tenant
 * routing (e.g. /t/[slug]/...).
 */

import { prisma } from "@/lib/db/prisma";
import type { SessionTenant } from "@/types/next-auth";

// Re-export so callers have a single import point for tenancy helpers.
export type { SessionTenant };

export type ActiveTenant = {
  id: string;
  slug: string;
  name: string;
  displayName: string | null;
};

/**
 * Returns the active tenant from session user fields.
 * Falls back to querying fc-allschwil from the DB if session is empty.
 * Returns null if no tenant can be resolved at all.
 */
export async function getActiveTenant(sessionUser: {
  activeTenantId?: string;
  activeTenantSlug?: string;
  activeTenantName?: string;
} | null | undefined): Promise<ActiveTenant | null> {
  if (
    sessionUser?.activeTenantId &&
    sessionUser.activeTenantSlug
  ) {
    return {
      id: sessionUser.activeTenantId,
      slug: sessionUser.activeTenantSlug,
      name: sessionUser.activeTenantName ?? sessionUser.activeTenantSlug,
      displayName: sessionUser.activeTenantName ?? null,
    };
  }

  // Session has no tenant context — query fallback tenant
  try {
    return await prisma.tenant.findFirst({
      where: { slug: "fc-allschwil", isActive: true },
      select: { id: true, slug: true, name: true, displayName: true },
    });
  } catch {
    return null;
  }
}

/**
 * Like getActiveTenant but throws if no tenant can be resolved.
 * Use in routes/actions that must have a tenant to function.
 */
export async function requireActiveTenant(sessionUser: {
  activeTenantId?: string;
  activeTenantSlug?: string;
  activeTenantName?: string;
} | null | undefined): Promise<ActiveTenant> {
  const tenant = await getActiveTenant(sessionUser);
  if (!tenant) {
    throw new Error(
      "No active tenant could be resolved. Run bootstrap:admin to seed the default tenant.",
    );
  }
  return tenant;
}

/**
 * Returns all tenants the given user is a member of, ordered by isDefault desc.
 * Returns [] if UserTenant table doesn't exist yet (pre-migration).
 */
export async function getUserTenants(userId: string): Promise<SessionTenant[]> {
  try {
    const rows = await prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, slug: true, name: true, displayName: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return rows.map((row) => ({
      id: row.tenant.id,
      slug: row.tenant.slug ?? "",
      name: row.tenant.name ?? "",
      displayName: row.tenant.displayName ?? null,
    }));
  } catch {
    return [];
  }
}
