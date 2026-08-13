/**
 * lib/roles/mutations.ts
 *
 * Tenant-scoped role/permission/assignment mutations for RPERM-05.
 *
 * Every function here:
 *   - takes an explicit `tenantId` resolved server-side by the caller
 *     (never trusts a client-submitted tenant id / role scope / role
 *     tenant id / protected status — those are always re-derived from the
 *     database inside this module);
 *   - re-validates tenant ownership and `scope: "TENANT"` on every role
 *     lookup, so a role id belonging to another tenant (or a PLATFORM role)
 *     can never be mutated through this module;
 *   - wraps multi-record writes in `prisma.$transaction` to avoid partial
 *     states;
 *   - throws a typed `RoleDomainError` subclass (see `lib/roles/errors.ts`)
 *     for every rejected case instead of a generic Error;
 *   - emits a best-effort audit log entry via the existing
 *     `lib/audit/log-action.ts` infrastructure after a successful commit.
 */

import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  ArchivedRoleError,
  DuplicateRoleNameError,
  InactiveMembershipError,
  InvalidPermissionScopeError,
  LastRequiredAdminError,
  ProtectedRoleError,
  RoleNotFoundError,
  RoleUserNotFoundError,
  RoleValidationError,
} from "@/lib/roles/errors";
import { findLockedPermissionRemovals, isProtectedRole } from "@/lib/roles/protected";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";

const AUDIT_MODULE_KEY = "roles";

type RoleRow = {
  id: string;
  scope: string;
  tenantId: string | null;
  isSystem: boolean;
  isArchived: boolean;
  name: string;
};

/** Fetches a role and asserts it belongs to `tenantId` and is TENANT-scoped. Throws RoleNotFoundError otherwise. */
async function loadOwnedTenantRole(tenantId: string, roleId: string): Promise<RoleRow> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, scope: "TENANT", tenantId },
    select: { id: true, scope: true, tenantId: true, isSystem: true, isArchived: true, name: true },
  });
  if (!role) throw new RoleNotFoundError();
  return role;
}

async function assertUniqueTenantRoleName(
  tenantId: string,
  name: string,
  excludeRoleId?: string,
): Promise<void> {
  const trimmed = name.trim();
  const existing = await prisma.role.findFirst({
    where: {
      scope: "TENANT",
      tenantId,
      name: { equals: trimmed, mode: "insensitive" },
      ...(excludeRoleId ? { id: { not: excludeRoleId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new DuplicateRoleNameError(trimmed);
}

/**
 * Validates that every requested permission key is TENANT-scoped and
 * grantable by a tenant admin, and resolves them to Permission rows.
 * Unknown keys are rejected (not silently dropped) — RPERM-05 mutation
 * responses must be unambiguous about what was actually persisted.
 */
async function resolveTenantPermissions(
  requestedKeys: readonly string[],
): Promise<{ id: string; key: string }[]> {
  const uniqueKeys = Array.from(new Set(requestedKeys));
  if (uniqueKeys.length === 0) return [];

  const permissions = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
    select: { id: true, key: true, scope: true, grantableByAdmin: true },
  });

  const foundKeys = new Set(permissions.map((p) => p.key));
  const missing = uniqueKeys.filter((k) => !foundKeys.has(k));
  if (missing.length > 0) {
    throw new RoleValidationError(`Unbekannte Berechtigung(en): ${missing.join(", ")}`);
  }

  const invalidScope = permissions.filter(
    (p) => p.scope !== "TENANT" || p.grantableByAdmin !== true,
  );
  if (invalidScope.length > 0) {
    throw new InvalidPermissionScopeError(
      `Diese Berechtigung(en) können nicht über die Mandanten-Verwaltung zugewiesen werden: ${invalidScope
        .map((p) => p.key)
        .join(", ")}`,
    );
  }

  return permissions.map((p) => ({ id: p.id, key: p.key }));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateTenantRoleInput = {
  tenantId: string;
  name: string;
  description?: string | null;
  permissionKeys: readonly string[];
  isActive: boolean;
  actorUserId: string;
};

export type TenantRoleMutationResult = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isArchived: boolean;
  permissionKeys: string[];
};

/**
 * Creates a tenant custom role. `scope` is always forced to `TENANT` and
 * `tenantId` is always the caller-resolved `tenantId` — there is no code
 * path that reads a scope or tenant id from the input for these fields, so
 * a request body claiming a different scope/tenant is simply ignored, not
 * merely rejected.
 */
export async function createTenantRole(
  input: CreateTenantRoleInput,
): Promise<TenantRoleMutationResult> {
  const name = input.name.trim();
  if (!name) throw new RoleValidationError("Der Rollenname ist erforderlich.");
  if (name.length > 120) {
    throw new RoleValidationError("Der Rollenname darf höchstens 120 Zeichen lang sein.");
  }

  const description = input.description?.trim() || null;

  await assertUniqueTenantRoleName(input.tenantId, name);
  const permissions = await resolveTenantPermissions(input.permissionKeys);

  const key = `custom_${input.tenantId.slice(0, 8)}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        key,
        name,
        description,
        scope: "TENANT",
        tenantId: input.tenantId,
        isSystem: false,
        isTemplate: false,
        isArchived: !input.isActive,
      },
      select: { id: true, key: true, name: true, description: true, isSystem: true, isArchived: true },
    });

    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Role",
    entityId: role.id,
    action: "CREATE",
    afterJson: {
      tenantId: input.tenantId,
      name: role.name,
      permissionKeys: permissions.map((p) => p.key),
      isArchived: role.isArchived,
    },
  });

  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isArchived: role.isArchived,
    permissionKeys: permissions.map((p) => p.key),
  };
}

// ---------------------------------------------------------------------------
// Update details (name / description / archived)
// ---------------------------------------------------------------------------

export type UpdateTenantRoleDetailsInput = {
  tenantId: string;
  roleId: string;
  name?: string;
  description?: string | null;
  isArchived?: boolean;
  actorUserId: string;
};

export async function updateTenantRoleDetails(
  input: UpdateTenantRoleDetailsInput,
): Promise<TenantRoleMutationResult> {
  const role = await loadOwnedTenantRole(input.tenantId, input.roleId);

  const wantsIdentityChange = input.name !== undefined || input.description !== undefined;
  const wantsArchiveChange = input.isArchived !== undefined && input.isArchived !== role.isArchived;

  if (isProtectedRole(role) && (wantsIdentityChange || wantsArchiveChange)) {
    throw new ProtectedRoleError(
      `"${role.name}" ist eine systemgeschützte Rolle und kann nicht umbenannt, beschrieben oder archiviert werden.`,
    );
  }

  const data: { name?: string; description?: string | null; isArchived?: boolean } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new RoleValidationError("Der Rollenname ist erforderlich.");
    await assertUniqueTenantRoleName(input.tenantId, name, role.id);
    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.isArchived !== undefined) {
    data.isArchived = input.isArchived;
  }

  const before = { name: role.name, isArchived: role.isArchived };

  const updated = await prisma.role.update({
    where: { id: role.id },
    data,
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      isArchived: true,
      rolePermissions: { select: { permission: { select: { key: true } } } },
    },
  });

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Role",
    entityId: updated.id,
    action: wantsArchiveChange ? (input.isArchived ? "ARCHIVE" : "RESTORE") : "UPDATE",
    beforeJson: before,
    afterJson: { name: updated.name, isArchived: updated.isArchived },
  });

  return {
    id: updated.id,
    key: updated.key,
    name: updated.name,
    description: updated.description,
    isSystem: updated.isSystem,
    isArchived: updated.isArchived,
    permissionKeys: updated.rolePermissions.map((rp) => rp.permission.key),
  };
}

// ---------------------------------------------------------------------------
// Permission matrix — bulk replace
// ---------------------------------------------------------------------------

export type SetTenantRolePermissionsInput = {
  tenantId: string;
  roleId: string;
  permissionKeys: readonly string[];
  actorUserId: string;
};

export async function setTenantRolePermissions(
  input: SetTenantRolePermissionsInput,
): Promise<{ permissionKeys: string[] }> {
  const role = await loadOwnedTenantRole(input.tenantId, input.roleId);

  if (role.isArchived) {
    throw new ArchivedRoleError("Archivierte Rollen können nicht bearbeitet werden.");
  }

  const currentPermissions = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permission: { select: { key: true } } },
  });
  const currentKeys = currentPermissions.map((rp) => rp.permission.key);

  const lockedRemovals = findLockedPermissionRemovals({
    isSystem: role.isSystem,
    currentKeys,
    requestedKeys: input.permissionKeys,
  });
  if (lockedRemovals.length > 0) {
    throw new ProtectedRoleError(
      `Diese Berechtigung(en) sind für "${role.name}" systemkritisch und können nicht entfernt werden: ${lockedRemovals.join(", ")}`,
    );
  }

  const permissions = await resolveTenantPermissions(input.permissionKeys);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Role",
    entityId: role.id,
    action: "PERMISSIONS_CHANGE",
    beforeJson: { permissionKeys: currentKeys },
    afterJson: { permissionKeys: permissions.map((p) => p.key) },
  });

  return { permissionKeys: permissions.map((p) => p.key) };
}

// ---------------------------------------------------------------------------
// Assignment — assign / remove
// ---------------------------------------------------------------------------

export type AssignTenantRoleInput = {
  tenantId: string;
  roleId: string;
  userId: string;
  actorUserId: string;
};

/** Idempotent: assigning a user who already holds the role is a no-op success. */
export async function assignTenantRoleToUser(
  input: AssignTenantRoleInput,
): Promise<{ assigned: boolean }> {
  const role = await loadOwnedTenantRole(input.tenantId, input.roleId);

  if (role.isArchived) {
    throw new ArchivedRoleError("Archivierte Rollen können nicht zugewiesen werden.");
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
    select: { isActive: true },
  });
  if (!membership) throw new RoleUserNotFoundError();
  if (!membership.isActive) throw new InactiveMembershipError();

  // ORG-ACCESS-01: look up tenant-wide assignment only (orgUnitId IS NULL).
  // Scoped assignments (orgUnitId set) are a separate concept and do not
  // conflict with tenant-wide ones. The old @@unique([userId, roleId]) is
  // replaced by partial indexes — findUnique({ where: { userId_roleId } })
  // is no longer available; use findFirst with explicit orgUnitId: null.
  const existing = await prisma.userRole.findFirst({
    where: { userId: input.userId, roleId: role.id, orgUnitId: null },
    select: { id: true, tenantId: true },
  });

  if (existing) {
    // Already assigned — idempotent no-op (self-heal tenantId if ever inconsistent).
    if (existing.tenantId !== input.tenantId) {
      await prisma.userRole.update({
        where: { id: existing.id },
        data: { tenantId: input.tenantId },
      });
    }
    return { assigned: false };
  }

  await prisma.userRole.create({
    data: { userId: input.userId, roleId: role.id, tenantId: input.tenantId },
  });

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "UserRole",
    entityId: `${input.userId}:${role.id}`,
    action: "USER_ASSIGNED",
    afterJson: { tenantId: input.tenantId, roleId: role.id, roleName: role.name, userId: input.userId },
  });

  return { assigned: true };
}

export type RemoveTenantRoleAssignmentInput = {
  tenantId: string;
  roleId: string;
  userId: string;
  actorUserId: string;
};

/**
 * Removes a UserRole assignment only — never touches TenantMembership.
 * Blocks removal of the last active assignee of an `isSystem` role within
 * the tenant (the "last required Club Admin" safeguard), generalized to any
 * protected system role rather than a display-label match.
 */
export async function removeTenantRoleAssignment(
  input: RemoveTenantRoleAssignmentInput,
): Promise<{ removed: boolean }> {
  const role = await loadOwnedTenantRole(input.tenantId, input.roleId);

  // ORG-ACCESS-01: look up tenant-wide assignment only (orgUnitId IS NULL).
  // Scoped assignments are managed separately and are never touched by this function.
  const existing = await prisma.userRole.findFirst({
    where: { userId: input.userId, roleId: role.id, orgUnitId: null },
    select: { id: true, tenantId: true },
  });

  if (!existing || existing.tenantId !== input.tenantId) {
    // Nothing to remove — idempotent no-op.
    return { removed: false };
  }

  if (isProtectedRole(role)) {
    const otherActiveAssignees = await prisma.userRole.count({
      where: {
        roleId: role.id,
        tenantId: input.tenantId,
        orgUnitId: null,
        userId: { not: input.userId },
        user: { tenantMemberships: { some: { tenantId: input.tenantId, isActive: true } } },
      },
    });
    if (otherActiveAssignees === 0) {
      throw new LastRequiredAdminError(
        `"${role.name}" kann diesem Benutzer nicht entzogen werden — er/sie ist der letzte aktive Träger dieser systemkritischen Rolle in diesem Mandanten.`,
      );
    }
  }

  await prisma.userRole.delete({ where: { id: existing.id } });

  await logAction({
    actorUserId: input.actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "UserRole",
    entityId: `${input.userId}:${role.id}`,
    action: "USER_REMOVED",
    beforeJson: { tenantId: input.tenantId, roleId: role.id, roleName: role.name, userId: input.userId },
  });

  return { removed: true };
}

// ---------------------------------------------------------------------------
// USER-ADMIN-02C — Bulk role sync for user detail page
// ---------------------------------------------------------------------------

export type SetTenantUserRolesInput = {
  tenantId: string;
  userId: string;
  /** Desired full set of TENANT role IDs for this user in this tenant. */
  roleIds: readonly string[];
  actorUserId: string;
};

export type SetTenantUserRolesResult = {
  /** Names of roles newly assigned in this call. */
  assigned: string[];
  /** Names of roles removed in this call. */
  removed: string[];
};

/**
 * Syncs the TENANT-scoped roles for a user within a tenant to exactly the
 * given `roleIds` set, adding and removing in a single transaction.
 *
 * Safety invariants:
 *  - All requested role IDs must be TENANT-scoped and owned by `tenantId`;
 *    cross-tenant or PLATFORM role IDs are rejected with RoleNotFoundError.
 *  - Archived roles are rejected (ArchivedRoleError).
 *  - Assignment and removal are permitted regardless of TenantMembership.isActive
 *    so admins can manage roles for inactive members (preserving roles for later
 *    reactivation). TenantMembership.isActive is NEVER modified.
 *  - Only the canonical Club Admin role (`club_admin__<tenantKey>`) is protected
 *    from last-holder removal (LastRequiredAdminError). All other isSystem roles
 *    are not last-holder-protected here. Uses getTenantClubAdminRoleKey — no
 *    fuzzy name matching.
 *  - PLATFORM UserRole records (tenantId: null) and other-tenant assignments
 *    are never touched — only TENANT rows for this exact tenant.
 */
export async function setTenantUserRoles(
  input: SetTenantUserRolesInput,
): Promise<SetTenantUserRolesResult> {
  const { tenantId, userId, roleIds, actorUserId } = input;

  // 1. Verify the user has a TenantMembership in this tenant (any state).
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) throw new RoleUserNotFoundError();

  // 2. Validate requested role IDs: must be TENANT-scoped, belong to this
  //    tenant, and not archived. Cross-tenant or PLATFORM IDs yield the same
  //    error as "not found" — no existence leakage.
  const deduped = Array.from(new Set(roleIds));

  const validRoles =
    deduped.length > 0
      ? await prisma.role.findMany({
          where: { id: { in: deduped }, scope: "TENANT", tenantId },
          select: { id: true, name: true, isSystem: true, isArchived: true },
        })
      : [];

  if (validRoles.length !== deduped.length) {
    throw new RoleNotFoundError();
  }

  const archivedRole = validRoles.find((r) => r.isArchived);
  if (archivedRole) {
    throw new ArchivedRoleError(
      `Die Rolle "${archivedRole.name}" ist archiviert und kann nicht zugewiesen werden.`,
    );
  }

  // 3. Fetch the current TENANT-scoped TENANT-WIDE assignments for this user in this tenant.
  // ORG-ACCESS-01: only consider orgUnitId=null rows here; scoped assignments
  // (orgUnitId set) are a separate concept and must not be clobbered by
  // this bulk-sync operation.
  const current = await prisma.userRole.findMany({
    where: { tenantId, userId, orgUnitId: null, role: { scope: "TENANT", tenantId } },
    select: {
      id: true,
      roleId: true,
      role: { select: { id: true, key: true, name: true } },
    },
  });

  const currentRoleIds = new Set(current.map((ur) => ur.roleId));
  const requestedSet = new Set(deduped);

  const toAdd = deduped.filter((id) => !currentRoleIds.has(id));
  const toRemove = current.filter((ur) => !requestedSet.has(ur.roleId));

  // 4. Last-Club-Admin guard: protect only the canonical Club Admin role
  //    (`club_admin__<tenantKey>`). Other isSystem roles are not protected here.
  //    Uses getTenantClubAdminRoleKey — no fuzzy name matching.
  if (toRemove.length > 0) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { key: true },
    });
    if (tenant) {
      const clubAdminRoleKey = getTenantClubAdminRoleKey(tenant.key);
      for (const ur of toRemove) {
        if (ur.role.key === clubAdminRoleKey) {
          const otherActiveClubAdmins = await prisma.userRole.count({
            where: {
              tenantId,
              userId: { not: userId },
              orgUnitId: null,
              role: { key: clubAdminRoleKey },
              user: { tenantMemberships: { some: { tenantId, isActive: true } } },
            },
          });
          if (otherActiveClubAdmins === 0) {
            throw new LastRequiredAdminError(
              `"${ur.role.name}" kann diesem Benutzer nicht entzogen werden — er/sie ist der letzte aktive Club Admin dieses Mandanten.`,
            );
          }
        }
      }
    }
  }

  // 6. Apply additions and removals atomically.
  if (toAdd.length > 0 || toRemove.length > 0) {
    await prisma.$transaction([
      ...toRemove.map((ur) => prisma.userRole.delete({ where: { id: ur.id } })),
      ...toAdd.map((roleId) =>
        prisma.userRole.create({ data: { userId, roleId, tenantId } }),
      ),
    ]);
  }

  // 7. Emit per-change audit entries (best-effort).
  const addedRoles = validRoles.filter((r) => toAdd.includes(r.id));
  for (const role of addedRoles) {
    await logAction({
      actorUserId,
      moduleKey: AUDIT_MODULE_KEY,
      entityType: "UserRole",
      entityId: `${userId}:${role.id}`,
      action: "USER_ASSIGNED",
      afterJson: { tenantId, roleId: role.id, roleName: role.name, userId },
    });
  }

  for (const ur of toRemove) {
    await logAction({
      actorUserId,
      moduleKey: AUDIT_MODULE_KEY,
      entityType: "UserRole",
      entityId: `${userId}:${ur.roleId}`,
      action: "USER_REMOVED",
      beforeJson: { tenantId, roleId: ur.roleId, roleName: ur.role.name, userId },
    });
  }

  return {
    assigned: addedRoles.map((r) => r.name),
    removed: toRemove.map((ur) => ur.role.name),
  };
}
