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
import {
  acquirePlatformSuperAdminMutationLock,
  PLATFORM_SUPERADMIN_ROLE_KEY,
  usablePlatformSuperAdminWhere,
} from "@/lib/security/platform-superadmin";

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
 * The canonical `super_admin` system role may gain permissions but may not
 * lose existing authority through ordinary administration.
 */
export async function setPlatformRolePermissions(
  input: SetPlatformRolePermissionsInput,
): Promise<SetPlatformRolePermissionsResult> {
  const role = await loadPlatformRole(input.roleId);

  const permissions = await resolvePlatformPermissions(input.permissionKeys);

  await prisma.$transaction(async (tx) => {
    await acquirePlatformSuperAdminMutationLock(tx);

    if (role.key === PLATFORM_SUPERADMIN_ROLE_KEY) {
      const current = await tx.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permission: { select: { key: true } } },
      });
      const requested = new Set(permissions.map((permission) => permission.key));
      const removed = current
        .map((assignment) => assignment.permission.key)
        .filter((key) => !requested.has(key));
      if (removed.length > 0) {
        throw new ProtectedRoleError(
          `Der systemgeschützten Rolle super_admin können keine Berechtigungen entzogen werden: ${removed.join(", ")}.`,
        );
      }
    }

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  });

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

  const mutation = await prisma.$transaction(async (tx) => {
    await acquirePlatformSuperAdminMutationLock(tx);

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, isActive: true },
    });
    if (!user) throw new RoleUserNotFoundError();

    // Scope guard: only ever read/touch canonical PLATFORM assignments.
    const currentPlatformUserRoles = await tx.userRole.findMany({
      where: {
        userId: input.userId,
        tenantId: null,
        role: { scope: "PLATFORM", tenantId: null },
      },
      select: {
        id: true,
        roleId: true,
        role: { select: { key: true, isSystem: true } },
      },
    });
    const currentPlatformRoleIds = new Set(
      currentPlatformUserRoles.map((ur) => ur.roleId),
    );
    const toRemove = currentPlatformUserRoles.filter(
      (ur) => !requestedRoleIds.has(ur.roleId),
    );
    const toAdd = foundRoles.filter(
      (role) => !currentPlatformRoleIds.has(role.id),
    );

    for (const ur of toRemove) {
      if (!ur.role.isSystem) continue;

      const otherHolders =
        ur.role.key === PLATFORM_SUPERADMIN_ROLE_KEY && user.isActive
          ? await tx.userRole.count({
              where: {
                ...usablePlatformSuperAdminWhere,
                roleId: ur.roleId,
                userId: { not: input.userId },
              },
            })
          : await tx.userRole.count({
              where: {
                roleId: ur.roleId,
                tenantId: null,
                userId: { not: input.userId },
              },
            });

      if (otherHolders === 0) {
        throw new LastRequiredAdminError(
          `"${ur.role.key}" kann diesem Benutzer nicht entzogen werden — er/sie ist der letzte aktive Träger dieser systemkritischen Plattform-Rolle.`,
        );
      }
    }

    if (toRemove.length > 0) {
      await tx.userRole.deleteMany({ where: { id: { in: toRemove.map((ur) => ur.id) } } });
    }
    for (const role of toAdd) {
      // tenantId is always null here — PLATFORM UserRole rows never carry a
      // tenant id, and this function never creates a TenantMembership.
      await tx.userRole.create({ data: { userId: input.userId, roleId: role.id, tenantId: null } });
    }
    return {
      beforeRoleIds: Array.from(currentPlatformRoleIds),
      changed: toRemove.length > 0 || toAdd.length > 0,
    };
  });

  if (input.actorUserId && mutation.changed) {
    await logAction({
      actorUserId: input.actorUserId,
      moduleKey: "users",
      entityType: "UserRole",
      entityId: input.userId,
      action: "PLATFORM_ROLES_CHANGE",
      beforeJson: { roleIds: mutation.beforeRoleIds },
      afterJson: { roleIds: Array.from(requestedRoleIds) },
    });
  }

  return { roleIds: Array.from(requestedRoleIds) };
}
