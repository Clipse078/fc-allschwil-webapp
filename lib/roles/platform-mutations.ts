/**
 * lib/roles/platform-mutations.ts
 *
 * RPERM-05-C1 — Finding 2: PLATFORM-scoped role/permission mutation
 * safeguards, mirroring the tenant-side scope validation already
 * established in `lib/roles/mutations.ts` (`resolveTenantPermissions`
 * rejects PLATFORM keys server-side; this module rejects TENANT keys
 * server-side — same shape, opposite scope).
 *
 * Every function here:
 *   - re-validates every requested permission key's `Permission.scope`
 *     from the database — never trusts the client, and never relies on UI
 *     filtering alone;
 *   - rejects the ENTIRE batch (throws before any write) when even one
 *     submitted key resolves to the wrong scope — no partial persist;
 *   - wraps the actual replace in `prisma.$transaction` so a role's
 *     permission set is never left half-updated;
 *   - throws a typed `RoleDomainError` subclass (see `lib/roles/errors.ts`)
 *     for every rejected case, matching the tenant module's error
 *     contract so API routes can share `toRoleApiErrorResponse`.
 */

import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  ArchivedRoleError,
  InvalidPermissionScopeError,
  LastRequiredAdminError,
  ProtectedRoleError,
  RoleNotFoundError,
  RoleUserNotFoundError,
  ScopeMismatchError,
} from "@/lib/roles/errors";
import { PERMISSIONS } from "@/lib/permissions/permissions";

async function loadPlatformRole(roleId: string): Promise<{ id: string; key: string }> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, scope: "PLATFORM" },
    select: { id: true, key: true },
  });
  if (!role) throw new RoleNotFoundError();
  return role;
}

/**
 * Validates every requested key resolves to `Permission.scope === "PLATFORM"`
 * before returning the matching rows. A single TENANT-scoped key anywhere
 * in the batch rejects the whole request atomically — mirrors
 * `resolveTenantPermissions()` in `lib/roles/mutations.ts`, inverted.
 * Unknown keys (no matching `Permission` row at all) are silently dropped,
 * matching this endpoint's pre-existing tolerance for stale client state —
 * only a *known, wrongly-scoped* key is a hard rejection.
 */
async function resolvePlatformPermissions(
  requestedKeys: readonly string[],
): Promise<{ id: string; key: string }[]> {
  const uniqueKeys = Array.from(new Set(requestedKeys));
  if (uniqueKeys.length === 0) return [];

  const permissions = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
    select: { id: true, key: true, scope: true },
  });

  const invalidScope = permissions.filter((p) => p.scope !== "PLATFORM");
  if (invalidScope.length > 0) {
    throw new InvalidPermissionScopeError(
      `Diese Berechtigung(en) sind mandanten-spezifisch (TENANT) und können keiner PLATFORM-Rolle zugewiesen werden: ${invalidScope
        .map((p) => p.key)
        .join(", ")}`,
    );
  }

  return permissions.map((p) => ({ id: p.id, key: p.key }));
}

export type SetPlatformRolePermissionsInput = {
  roleId: string;
  permissionKeys: readonly string[];
};

export type SetPlatformRolePermissionsResult = {
  permissionKeys: string[];
};

/**
 * Bulk-replaces a PLATFORM role's permission set. Every requested key is
 * re-validated as `scope === "PLATFORM"`; a TENANT key anywhere in the
 * request rejects the whole batch before any write (no partial persist).
 * Preserves the pre-existing `super_admin` / `users.manage` lockout
 * safeguard (never let the last role holding `users.manage` lose it).
 */
export async function setPlatformRolePermissions(
  input: SetPlatformRolePermissionsInput,
): Promise<SetPlatformRolePermissionsResult> {
  const role = await loadPlatformRole(input.roleId);

  if (role.key === "super_admin" && !input.permissionKeys.includes(PERMISSIONS.USERS_MANAGE)) {
    const otherRolesWithManage = await prisma.rolePermission.count({
      where: {
        permission: { key: PERMISSIONS.USERS_MANAGE },
        role: { key: { not: "super_admin" } },
      },
    });
    if (otherRolesWithManage === 0) {
      throw new ProtectedRoleError(
        `${PERMISSIONS.USERS_MANAGE} kann nicht von super_admin entfernt werden — es wäre kein Benutzer mehr mit dieser Berechtigung vorhanden.`,
      );
    }
  }

  const permissions = await resolvePlatformPermissions(input.permissionKeys);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  return { permissionKeys: permissions.map((p) => p.key) };
}

// ---------------------------------------------------------------------------
// Platform user-role assignment (Finding 3 — the legacy /api/users/[userId]/roles endpoint)
// ---------------------------------------------------------------------------

export type SetPlatformUserRolesInput = {
  userId: string;
  roleIds: readonly string[];
  actorUserId?: string;
};

export type SetPlatformUserRolesResult = {
  roleIds: string[];
};

/**
 * Bulk-replaces a user's PLATFORM-scoped role assignments only.
 *
 * Every safety property required by RPERM-05-C1 Finding 3:
 *   - loads and accepts only `Role.scope === "PLATFORM"` role ids — a
 *     TENANT role id anywhere in the request rejects the whole batch
 *     (never silently dropped, never partially applied);
 *   - never creates, updates, or reads a `TenantMembership` row;
 *   - never touches a `UserRole` row where `tenantId IS NOT NULL` (or,
 *     equivalently, whose `role.scope === "TENANT"`) — those rows are
 *     managed exclusively by the RPERM-05 tenant-scoped assignment APIs
 *     (`/api/tenant/roles/[id]/members`), which already enforce active
 *     membership, tenant isolation, and last-active-Club-Admin
 *     safeguards;
 *   - blocks removing the last platform-wide holder of an `isSystem`
 *     PLATFORM role (e.g. the last `super_admin`) — the platform
 *     equivalent of the tenant module's `LastRequiredAdminError` guard in
 *     `lib/roles/mutations.ts`;
 *   - runs the actual UserRole delete/create inside `prisma.$transaction`;
 *   - is idempotent — submitting the user's current platform role set is
 *     a no-op success.
 */
export async function setPlatformUserRoles(
  input: SetPlatformUserRolesInput,
): Promise<SetPlatformUserRolesResult> {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new RoleUserNotFoundError();

  const uniqueRequestedIds = Array.from(new Set(input.roleIds));

  const foundRoles = uniqueRequestedIds.length
    ? await prisma.role.findMany({
        where: { id: { in: uniqueRequestedIds } },
        select: { id: true, key: true, name: true, scope: true, isSystem: true, isArchived: true, isTemplate: true },
      })
    : [];

  const notFoundIds = uniqueRequestedIds.filter((id) => !foundRoles.some((r) => r.id === id));
  if (notFoundIds.length > 0) {
    throw new RoleNotFoundError();
  }

  const tenantRoles = foundRoles.filter((r) => r.scope !== "PLATFORM");
  if (tenantRoles.length > 0) {
    throw new ScopeMismatchError(
      `Diese Rolle(n) sind mandanten-spezifisch (TENANT) und können nicht über die Plattform-Benutzerverwaltung zugewiesen werden: ${tenantRoles
        .map((r) => r.key)
        .join(", ")}. Verwenden Sie die Mandanten-Rollenverwaltung.`,
    );
  }

  const unassignableRoles = foundRoles.filter((r) => r.isArchived || r.isTemplate);
  if (unassignableRoles.length > 0) {
    throw new ArchivedRoleError(
      `Diese Rolle(n) sind archiviert oder Vorlagen und können nicht zugewiesen werden: ${unassignableRoles
        .map((r) => r.key)
        .join(", ")}.`,
    );
  }

  const requestedRoleIds = new Set(foundRoles.map((r) => r.id));

  // Scope guard: only ever read/touch PLATFORM-scoped UserRole rows for
  // this user — TENANT-scoped assignments (tenantId IS NOT NULL) are never
  // part of this query and therefore can never be deleted or altered here.
  const currentPlatformUserRoles = await prisma.userRole.findMany({
    where: { userId: input.userId, role: { scope: "PLATFORM" } },
    select: { id: true, roleId: true, role: { select: { key: true, isSystem: true } } },
  });
  const currentPlatformRoleIds = new Set(currentPlatformUserRoles.map((ur) => ur.roleId));

  const toRemove = currentPlatformUserRoles.filter((ur) => !requestedRoleIds.has(ur.roleId));
  const toAdd = foundRoles.filter((r) => !currentPlatformRoleIds.has(r.id));

  // Last-required-admin safeguard, platform equivalent: never let a
  // request remove the last platform-wide holder of an isSystem PLATFORM
  // role (e.g. the last super_admin) — never weakens recovery access.
  for (const ur of toRemove) {
    if (!ur.role.isSystem) continue;
    const otherHolders = await prisma.userRole.count({
      where: { roleId: ur.roleId, userId: { not: input.userId } },
    });
    if (otherHolders === 0) {
      throw new LastRequiredAdminError(
        `"${ur.role.key}" kann diesem Benutzer nicht entzogen werden — er/sie ist der letzte Träger dieser systemkritischen Plattform-Rolle.`,
      );
    }
  }

  if (toRemove.length === 0 && toAdd.length === 0) {
    // Idempotent no-op — nothing to change, no transaction needed.
    return { roleIds: Array.from(requestedRoleIds) };
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.userRole.deleteMany({ where: { id: { in: toRemove.map((ur) => ur.id) } } });
    }
    for (const role of toAdd) {
      // tenantId is always null here — PLATFORM UserRole rows never carry a
      // tenant id, and this function never creates a TenantMembership.
      await tx.userRole.create({ data: { userId: input.userId, roleId: role.id, tenantId: null } });
    }
  });

  if (input.actorUserId) {
    await logAction({
      actorUserId: input.actorUserId,
      moduleKey: "users",
      entityType: "UserRole",
      entityId: input.userId,
      action: "PLATFORM_ROLES_CHANGE",
      beforeJson: { roleIds: Array.from(currentPlatformRoleIds) },
      afterJson: { roleIds: Array.from(requestedRoleIds) },
    });
  }

  return { roleIds: Array.from(requestedRoleIds) };
}
