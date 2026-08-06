/**
 * RPERM-04 — Session Tenant Context Resolution
 *
 * Single source of truth for deriving the tenant portion of a user's session
 * (activeTenantId, activeMembershipId, availableTenants) and the effective
 * permission keys carried in the session for fast, synchronous UI checks
 * (nav visibility, dashboard module gating, etc.).
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Before RPERM-04, auth.ts derived tenant context from the legacy
 * `User.tenantId` column and flattened ALL of a user's role permissions
 * (platform + tenant, regardless of scope or tenant ownership) into a single
 * `permissionKeys` array. This meant a Platform Super Admin — who typically
 * holds a PLATFORM-scoped role containing every permission key, including
 * TENANT-scoped ones — silently inherited full operational access to every
 * tenant, without ever holding a TenantMembership or a tenant-scoped role.
 *
 * RPERM-04 replaces both mechanisms:
 *   - Tenant context is derived exclusively from active `TenantMembership`
 *     rows (see resolveTenantMembershipContext()).
 *   - `permissionKeys` is derived from the RPERM-03 EffectivePermissionResolver,
 *     scoped to (platform ∪ activeTenantId) — never a blind flatten of every
 *     role a user happens to hold.
 *
 * This module is used by auth.ts (login + JWT refresh) and by the
 * impersonation route (which must rebuild the target user's session using
 * the exact same rules).
 */

import type { PrismaClient } from "@prisma/client";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

export type SessionTenantContext = {
  activeTenantId: string | null;
  activeMembershipId: string | null;
  availableTenants: { id: string; key: string; name: string }[];
};

/**
 * Resolves a user's tenant context from active TenantMembership rows whose
 * related Tenant is also operationally ACTIVE only.
 *
 * RPERM-04-C1: a membership being `isActive: true` is necessary but not
 * sufficient — a membership linked to an ARCHIVED or INACTIVE tenant must
 * never surface as an `activeTenantId`, `activeMembershipId`, or an entry in
 * `availableTenants`. This filter is applied at the database level
 * (`tenant: { status: "ACTIVE" }`) so archived/inactive tenants are excluded
 * before any selection logic runs — an archived tenant simply does not
 * exist from this function's point of view.
 *
 * Selection rule for `activeTenantId`: the membership with the earliest
 * `joinedAt` is chosen as the default active tenant. This is a deterministic,
 * stable placeholder for true tenant-switching (not yet built — see
 * `availableTenants`, which already lists every tenant the user could switch
 * into). Users with zero eligible memberships (e.g. platform-only admins, or
 * users whose only membership is in an archived/inactive tenant) get
 * `activeTenantId: null` and an empty `availableTenants` list.
 */
export async function resolveTenantMembershipContext(
  prisma: PrismaClient,
  userId: string,
): Promise<SessionTenantContext> {
  if (!userId) {
    return { activeTenantId: null, activeMembershipId: null, availableTenants: [] };
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId, isActive: true, tenant: { status: "ACTIVE" } },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      tenant: {
        select: { id: true, key: true, name: true },
      },
    },
  });

  if (memberships.length === 0) {
    return { activeTenantId: null, activeMembershipId: null, availableTenants: [] };
  }

  const active = memberships[0];

  return {
    activeTenantId: active.tenant.id,
    activeMembershipId: active.id,
    availableTenants: memberships.map((m) => ({
      id: m.tenant.id,
      key: m.tenant.key,
      name: m.tenant.name,
    })),
  };
}

/**
 * Resolves the session-carried `permissionKeys` array: the union of the
 * user's PLATFORM-scoped permissions and their TENANT-scoped permissions for
 * `activeTenantId` (when present), computed via the canonical RPERM-03
 * EffectivePermissionResolver.
 *
 * This array is a cached fast-path for synchronous UI decisions (nav
 * visibility, module gating). It is NOT the authorization boundary — actual
 * access control goes through the resolver at request time via
 * requirePermission()/requireApiPermission() (see lib/permissions/require-*).
 * Like any JWT-cached value, it only refreshes at next sign-in or explicit
 * session update.
 */
export async function resolveSessionPermissionKeys(
  prisma: PrismaClient,
  userId: string,
  activeTenantId: string | null,
): Promise<string[]> {
  if (!userId) return [];

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({
    userId,
    tenantId: activeTenantId ?? undefined,
  });

  return Array.from(new Set([...platform, ...tenant])).sort();
}
