/**
 * lib/roles/effective-access.ts
 *
 * Read-only "effective access" diagnostic for a tenant member (RPERM-05).
 *
 * This is a *view* over data already computed by the canonical
 * `EffectivePermissionResolver` (RPERM-03) — it never re-implements
 * permission resolution. Module visibility (`visibleNavItems`/
 * `deniedNavItems`) is derived by running the exact same
 * `getVisibleNavSections()` helper the sidebar uses
 * (`lib/nav/nav-config.ts`) against the resolver's live output, so this
 * preview can never drift from what the sidebar/route guards actually do.
 */

import { prisma } from "@/lib/db/prisma";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { getVisibleNavSections, flattenNavSections, NAV_SECTIONS } from "@/lib/nav/nav-config";
import type { PermissionKey } from "@/lib/permissions/permissions";

export type EffectiveAccessRole = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  isArchived: boolean;
};

export type EffectiveAccessNavItem = {
  label: string;
  href: string;
};

export type UserEffectiveAccessView = {
  user: { id: string; firstName: string; lastName: string; email: string };
  tenantId: string;
  membershipIsActive: boolean;
  /** All TENANT-scoped UserRole assignments in this tenant, including archived roles (shown, but excluded from the resolver's grants). */
  assignedRoles: EffectiveAccessRole[];
  /** Platform-scoped roles this user holds (shown separately — never merged into tenant grants). */
  platformRoles: EffectiveAccessRole[];
  /** Deduplicated effective TENANT permission keys, straight from EffectivePermissionResolver. */
  effectiveTenantPermissionKeys: string[];
  /** Deduplicated effective PLATFORM permission keys, straight from EffectivePermissionResolver. */
  effectivePlatformPermissionKeys: string[];
  visibleNavItems: EffectiveAccessNavItem[];
  deniedNavItems: EffectiveAccessNavItem[];
};

/**
 * Builds the effective-access view for `userId` within `tenantId`.
 * Returns null when the target user does not exist or has no
 * TenantMembership row for this exact tenant at all (never leaks whether a
 * user exists in a DIFFERENT tenant).
 */
export async function getUserEffectiveAccessView(
  tenantId: string,
  userId: string,
): Promise<UserEffectiveAccessView | null> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      isActive: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userRoles: {
            select: {
              tenantId: true,
              role: {
                select: { id: true, key: true, name: true, scope: true, isSystem: true, isArchived: true, tenantId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) return null;

  const assignedRoles = membership.user.userRoles
    .filter((ur) => ur.role.scope === "TENANT" && ur.role.tenantId === tenantId && ur.tenantId === tenantId)
    .map((ur) => ({
      id: ur.role.id,
      key: ur.role.key,
      name: ur.role.name,
      isSystem: ur.role.isSystem,
      isArchived: ur.role.isArchived,
    }));

  const platformRoles = membership.user.userRoles
    .filter((ur) => ur.role.scope === "PLATFORM" && ur.tenantId === null)
    .map((ur) => ({
      id: ur.role.id,
      key: ur.role.key,
      name: ur.role.name,
      isSystem: ur.role.isSystem,
      isArchived: ur.role.isArchived,
    }));

  const resolver = createEffectivePermissionResolver(prisma);
  const { platform, tenant } = await resolver.getEffectivePermissions({ userId, tenantId });

  const effectiveKeys = Array.from(new Set([...platform, ...tenant])) as PermissionKey[];
  const visibleSections = getVisibleNavSections(effectiveKeys);
  const visibleItems = flattenNavSections(visibleSections);
  const visibleHrefs = new Set(visibleItems.map((item) => item.href));

  const allItems = flattenNavSections(NAV_SECTIONS);
  const deniedItems = allItems.filter((item) => !visibleHrefs.has(item.href));

  return {
    user: {
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      email: membership.user.email,
    },
    tenantId,
    membershipIsActive: membership.isActive,
    assignedRoles,
    platformRoles,
    effectiveTenantPermissionKeys: [...tenant],
    effectivePlatformPermissionKeys: [...platform],
    visibleNavItems: visibleItems.map((item) => ({ label: item.label, href: item.href })),
    deniedNavItems: deniedItems.map((item) => ({ label: item.label, href: item.href })),
  };
}
