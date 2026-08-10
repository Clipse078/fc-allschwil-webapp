/**
 * lib/roles/tenant-queries.ts
 *
 * Read queries for the RPERM-05 tenant-facing Roles & Permissions module.
 *
 * Every query here is scoped by an explicit `tenantId` parameter resolved
 * server-side by the caller (via `requireActiveTenantId()` /
 * `requireApiActiveTenantId()` — never a client-submitted value) and every
 * `Role` lookup filters `scope: "TENANT"` AND `tenantId` in the same
 * `where` clause, so a role owned by a different tenant can never be
 * returned even if its id is guessed/brute-forced.
 */

import { prisma } from "@/lib/db/prisma";
import { isProtectedRole, lockedPermissionKeysForRole } from "@/lib/roles/protected";

export type TenantRoleListItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isArchived: boolean;
  userCount: number;
  permissionCount: number;
  updatedAt: Date;
};

/** All TENANT-scoped roles owned by this exact tenant — system + custom, active + archived. */
export async function getTenantRolesOverview(tenantId: string): Promise<TenantRoleListItem[]> {
  const roles = await prisma.role.findMany({
    where: { scope: "TENANT", tenantId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      isArchived: true,
      updatedAt: true,
      _count: { select: { rolePermissions: true } },
      userRoles: {
        where: { tenantId, user: { tenantMemberships: { some: { tenantId, isActive: true } } } },
        select: { id: true },
      },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isArchived: role.isArchived,
    userCount: role.userRoles.length,
    permissionCount: role._count.rolePermissions,
    updatedAt: role.updatedAt,
  }));
}

export type TenantRolePermissionItem = {
  id: string;
  key: string;
  name: string;
  module: string;
};

export type TenantRoleAssignedUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipIsActive: boolean;
  assignedAt: Date;
};

export type TenantRoleDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: TenantRolePermissionItem[];
  assignedUsers: TenantRoleAssignedUser[];
  lockedPermissionKeys: string[];
};

/**
 * Full detail for one tenant role. Returns null when the role does not
 * exist OR does not belong to `tenantId` OR is not TENANT-scoped — the
 * caller cannot distinguish "wrong tenant" from "not found", which is
 * intentional (no cross-tenant existence leakage).
 */
export async function getTenantRoleDetail(
  tenantId: string,
  roleId: string,
): Promise<TenantRoleDetail | null> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, scope: "TENANT", tenantId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      rolePermissions: {
        select: {
          permission: { select: { id: true, key: true, name: true, module: true } },
        },
      },
      userRoles: {
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              tenantMemberships: {
                where: { tenantId },
                select: { isActive: true },
              },
            },
          },
        },
      },
    },
  });

  if (!role) return null;

  const permissionKeys = role.rolePermissions.map((rp) => rp.permission.key);

  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isArchived: role.isArchived,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissions: role.rolePermissions.map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
      module: String(rp.permission.module),
    })),
    assignedUsers: role.userRoles.map((ur) => ({
      id: ur.user.id,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      email: ur.user.email,
      membershipIsActive: ur.user.tenantMemberships[0]?.isActive ?? false,
      assignedAt: ur.createdAt,
    })),
    lockedPermissionKeys: lockedPermissionKeysForRole({
      isSystem: role.isSystem,
      currentKeys: permissionKeys,
    }),
  };
}

export type TenantPermissionRow = {
  id: string;
  key: string;
  name: string;
  module: string;
};

export type TenantPermissionModuleGroup = {
  module: string;
  permissions: TenantPermissionRow[];
};

/**
 * The full catalog of permissions a tenant admin may assign — always
 * `scope: "TENANT"` AND `grantableByAdmin: true`. This is the only source
 * used to build the RPERM-05 permission matrix; PLATFORM-scoped or
 * non-grantable permissions never appear here, so the tenant UI cannot even
 * render a checkbox for them (defense in depth on top of the server-side
 * scope validation in `lib/roles/mutations.ts`).
 */
export async function getTenantPermissionCatalog(): Promise<TenantPermissionModuleGroup[]> {
  const permissions = await prisma.permission.findMany({
    where: { scope: "TENANT", grantableByAdmin: true },
    orderBy: [{ module: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, module: true },
  });

  const groups = new Map<string, TenantPermissionRow[]>();
  for (const perm of permissions) {
    const mod = String(perm.module);
    const rows = groups.get(mod) ?? [];
    rows.push({ id: perm.id, key: perm.key, name: perm.name, module: mod });
    groups.set(mod, rows);
  }

  return Array.from(groups.entries()).map(([module, permissionsInModule]) => ({
    module,
    permissions: permissionsInModule,
  }));
}

export type EligibleTenantMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleIds: string[];
};

/**
 * The canonical eligible-user source for tenant role assignment:
 * active `TenantMembership` rows for this exact tenant — never
 * `User.tenantId` (legacy, deprecated as an authorization/eligibility
 * source per RPERM-04). Includes each member's currently assigned TENANT
 * role ids (scoped to this tenant) so the assignment UI can render
 * checked/unchecked state without a second round trip.
 */
export async function getEligibleTenantMembers(tenantId: string): Promise<EligibleTenantMember[]> {
  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId, isActive: true },
    orderBy: { user: { lastName: "asc" } },
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          userRoles: {
            where: { tenantId, role: { scope: "TENANT", tenantId } },
            select: { roleId: true },
          },
        },
      },
    },
  });

  return memberships
    .filter((m) => m.user.isActive)
    .map((m) => ({
      userId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      roleIds: m.user.userRoles.map((ur) => ur.roleId),
    }));
}

/** Re-exported for UI badge rendering without importing lib/roles/protected directly. */
export { isProtectedRole };

// ---------------------------------------------------------------------------
// ADMIN-MASTERDATA-UX-01 — Person ↔ tenant-role assignment (Person detail
// "Zugang & Rollen" card)
// ---------------------------------------------------------------------------

export type PersonLinkedUserRoleAssignment = {
  userId: string;
  /** Active TenantMembership in `tenantId` — the same eligibility source as
   * getEligibleTenantMembers(). False (not absent) when the linked User
   * exists but its membership in this exact tenant is inactive. */
  isActiveMember: boolean;
  /** TENANT-scoped role ids currently assigned to this user in `tenantId`. */
  roleIds: string[];
};

/**
 * Resolves a single already-known `userId` (from `Person.userId`) to its
 * tenant-role assignment state within `tenantId` — the read side of the
 * Person detail "Zugang & Rollen" card.
 *
 * Returns `null` when the user has no `TenantMembership` row for
 * `tenantId` at all (never a member of this tenant — e.g. the Person's
 * linked User belongs to a different tenant). This is the same tenant
 * isolation boundary `assignTenantRoleToUser`/`removeTenantRoleAssignment`
 * (lib/roles/mutations.ts) already enforce server-side: a caller cannot
 * assign/remove a tenant role for a user with no active membership in that
 * tenant, so this read-side helper mirrors that exactly rather than
 * inventing a second eligibility rule.
 *
 * `roleIds` only ever contains TENANT-scoped roles owned by this exact
 * tenant (`role: { scope: "TENANT", tenantId }`) — a PLATFORM role, or a
 * TENANT role owned by a different tenant, can never appear here.
 */
export async function getTenantRoleAssignmentForUser(
  tenantId: string,
  userId: string,
): Promise<PersonLinkedUserRoleAssignment | null> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) return null;

  const userRoles = await prisma.userRole.findMany({
    where: { tenantId, userId, role: { scope: "TENANT", tenantId } },
    select: { roleId: true },
  });

  return {
    userId,
    isActiveMember: membership.isActive,
    roleIds: userRoles.map((ur) => ur.roleId),
  };
}
