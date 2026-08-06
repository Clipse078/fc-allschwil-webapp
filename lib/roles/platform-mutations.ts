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
import {
  InvalidPermissionScopeError,
  ProtectedRoleError,
  RoleNotFoundError,
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
