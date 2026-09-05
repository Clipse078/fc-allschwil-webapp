/**
 * lib/roles/scoped-mutations.ts
 *
 * ORG-ACCESS-02: OrgUnit-scoped role assignment mutations.
 *
 * Scoped assignments complement the existing tenant-wide UserRole rows:
 *   orgUnitId = null  → tenant-wide (managed by lib/roles/mutations.ts)
 *   orgUnitId set     → OrgUnit-scoped (managed by this module)
 *
 * Invariants enforced here:
 *   - tenantId always resolved server-side from the caller's session
 *   - Role must be TENANT-scoped, owned by the given tenant, not archived
 *   - Role must NOT be the tenant's canonical Club Admin role (tenant-wide only)
 *   - PLATFORM roles are rejected
 *   - OrgUnit must belong to the given tenant
 *   - User must have a TenantMembership in the given tenant
 *   - Exact duplicates (userId, roleId, orgUnitId) are rejected (or no-op on idempotent assign)
 *   - Removing one scoped assignment never touches other scoped or tenant-wide assignments
 *   - Audit entries written via logAction after successful commit
 */

import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  ArchivedRoleError,
  RoleDomainError,
  RoleNotFoundError,
  RoleUserNotFoundError,
  RoleValidationError,
} from "@/lib/roles/errors";
import { getTenantClubAdminRoleKey, CLUB_ADMIN_TEMPLATE_KEY } from "@/lib/roles/tenant-role-keys";
import { assertTenantDelegationAllowed } from "@/lib/roles/delegation";
import type { OrgUnitScopeMode } from "@prisma/client";

const AUDIT_MODULE_KEY = "roles";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RoleRow = {
  id: string;
  key: string;
  scope: string;
  tenantId: string | null;
  name: string;
  isSystem: boolean;
  isArchived: boolean;
};

/** Load a TENANT-scoped role owned by `tenantId`. Rejects PLATFORM and cross-tenant roles. */
async function loadOwnedTenantRole(tenantId: string, roleId: string): Promise<RoleRow> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, scope: "TENANT", tenantId },
    select: {
      id: true,
      key: true,
      scope: true,
      tenantId: true,
      name: true,
      isSystem: true,
      isArchived: true,
    },
  });
  if (!role) throw new RoleNotFoundError();
  return role;
}

/** Rejects the canonical Club Admin role from being used as a scoped responsibility. */
async function assertNotClubAdminRole(
  role: RoleRow,
  tenantId: string,
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { key: true },
  });
  if (!tenant) throw new RoleValidationError("Mandant nicht gefunden.");

  const clubAdminKey = getTenantClubAdminRoleKey(tenant.key);
  if (role.key === clubAdminKey || role.key === CLUB_ADMIN_TEMPLATE_KEY) {
    throw new RoleDomainError(
      "SCOPE_MISMATCH",
      "Die Club-Admin-Rolle kann nicht als Bereichszuständigkeit zugewiesen werden. Sie bleibt mandantenweit.",
      409,
    );
  }
}

/** Verify that the OrgUnit exists and belongs to `tenantId`. */
async function assertOrgUnitBelongsToTenant(
  tenantId: string,
  orgUnitId: string,
): Promise<{ id: string; name: string }> {
  const orgUnit = await prisma.orgUnit.findFirst({
    where: { id: orgUnitId, tenantId },
    select: { id: true, name: true },
  });
  if (!orgUnit) {
    throw new RoleValidationError(
      "Organisationseinheit nicht gefunden oder gehört nicht zu diesem Mandanten.",
    );
  }
  return orgUnit;
}

// ---------------------------------------------------------------------------
// Read — list scoped assignments for an OrgUnit
// ---------------------------------------------------------------------------

export type ScopedRoleAssignment = {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  scopeMode: OrgUnitScopeMode;
  orgUnitId: string;
  orgUnitName: string;
  firstName: string;
  lastName: string;
  email: string;
  /** True when Person.userId links this user to a Person record. */
  hasLinkedPerson: boolean;
  createdAt: Date;
};

/**
 * Returns all scoped UserRole assignments for a given OrgUnit.
 * Only rows where `orgUnitId = orgUnitId` and the role belongs to `tenantId`.
 */
export async function getScopedAssignmentsForOrgUnit(
  tenantId: string,
  orgUnitId: string,
): Promise<ScopedRoleAssignment[]> {
  const rows = await prisma.userRole.findMany({
    where: {
      orgUnitId,
      tenantId,
      role: { scope: "TENANT", tenantId },
    },
    orderBy: [{ role: { name: "asc" } }, { user: { lastName: "asc" } }],
    select: {
      id: true,
      userId: true,
      roleId: true,
      scopeMode: true,
      orgUnitId: true,
      createdAt: true,
      role: { select: { name: true, key: true } },
      orgUnit: { select: { name: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          person: { select: { id: true } },
        },
      },
    },
  });

  return rows
    .filter((r) => r.orgUnitId !== null && r.scopeMode !== null && r.orgUnit !== null)
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      roleId: r.roleId,
      roleName: r.role.name,
      roleKey: r.role.key,
      scopeMode: r.scopeMode as OrgUnitScopeMode,
      orgUnitId: r.orgUnitId as string,
      orgUnitName: r.orgUnit!.name,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      email: r.user.email,
      hasLinkedPerson: r.user.person !== null,
      createdAt: r.createdAt,
    }));
}

/**
 * Returns all scoped UserRole assignments for a given user in a tenant.
 * Used by the consolidated user detail view.
 */
export async function getScopedAssignmentsForUser(
  tenantId: string,
  userId: string,
): Promise<ScopedRoleAssignment[]> {
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId,
      orgUnitId: { not: null },
      role: { scope: "TENANT", tenantId },
    },
    orderBy: [{ orgUnit: { name: "asc" } }, { role: { name: "asc" } }],
    select: {
      id: true,
      userId: true,
      roleId: true,
      scopeMode: true,
      orgUnitId: true,
      createdAt: true,
      role: { select: { name: true, key: true } },
      orgUnit: { select: { name: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          person: { select: { id: true } },
        },
      },
    },
  });

  return rows
    .filter((r) => r.orgUnitId !== null && r.scopeMode !== null && r.orgUnit !== null)
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      roleId: r.roleId,
      roleName: r.role.name,
      roleKey: r.role.key,
      scopeMode: r.scopeMode as OrgUnitScopeMode,
      orgUnitId: r.orgUnitId as string,
      orgUnitName: r.orgUnit!.name,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      email: r.user.email,
      hasLinkedPerson: r.user.person !== null,
      createdAt: r.createdAt,
    }));
}

// ---------------------------------------------------------------------------
// Assign — create a scoped role assignment
// ---------------------------------------------------------------------------

export type AssignScopedRoleInput = {
  tenantId: string;
  userId: string;
  roleId: string;
  orgUnitId: string;
  /**
   * THIS_ORG_UNIT — permission applies to the exact OrgUnit only.
   * THIS_ORG_UNIT_AND_DESCENDANTS — applies to the OrgUnit and all descendants.
   * Defaults to THIS_ORG_UNIT when not provided.
   */
  scopeMode?: OrgUnitScopeMode;
  actorUserId: string;
};

export type AssignScopedRoleResult = {
  assigned: boolean;
  userRoleId: string;
};

/**
 * Creates a scoped UserRole assignment.
 *
 * Idempotent: if the exact same (userId, roleId, orgUnitId) already exists,
 * returns { assigned: false } without error. Updating scopeMode on an existing
 * assignment is NOT supported — callers must remove and re-create.
 */
export async function assignScopedRoleToUser(
  input: AssignScopedRoleInput,
): Promise<AssignScopedRoleResult> {
  const { tenantId, userId, roleId, orgUnitId, actorUserId } = input;
  const scopeMode: OrgUnitScopeMode = input.scopeMode ?? "THIS_ORG_UNIT";

  // 1. Validate role: TENANT-scoped, owned by tenantId, not archived, not Club Admin.
  const role = await loadOwnedTenantRole(tenantId, roleId);
  if (role.isArchived) {
    throw new ArchivedRoleError("Archivierte Rollen können nicht als Zuständigkeit zugewiesen werden.");
  }
  await assertNotClubAdminRole(role, tenantId);
  await assertTenantDelegationAllowed({
    tenantId,
    actorUserId,
    roleIds: [role.id],
  });

  // 2. Validate OrgUnit: exists and belongs to tenantId.
  const orgUnit = await assertOrgUnitBelongsToTenant(tenantId, orgUnitId);

  // 3. Validate user: must have TenantMembership (any state — same leniency as setTenantUserRoles).
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { isActive: true },
  });
  if (!membership) throw new RoleUserNotFoundError();

  // 4. Check for exact duplicate (userId, roleId, orgUnitId).
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, orgUnitId },
    select: { id: true },
  });
  if (existing) {
    return { assigned: false, userRoleId: existing.id };
  }

  // 5. Create the scoped assignment.
  const created = await prisma.userRole.create({
    data: {
      userId,
      roleId,
      tenantId,
      orgUnitId,
      scopeMode,
    },
    select: { id: true },
  });

  // 6. Audit log.
  await logAction({
    tenantId,
    actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "UserRole",
    entityId: created.id,
    action: "USER_ASSIGNED",
    afterJson: {
      tenantId,
      roleId,
      roleName: role.name,
      userId,
      orgUnitId,
      orgUnitName: orgUnit.name,
      scopeMode,
    },
  });

  return { assigned: true, userRoleId: created.id };
}

// ---------------------------------------------------------------------------
// Remove — delete a scoped role assignment by its UserRole.id
// ---------------------------------------------------------------------------

export type RemoveScopedRoleInput = {
  tenantId: string;
  userRoleId: string;
  actorUserId: string;
};

export type RemoveScopedRoleResult = {
  removed: boolean;
};

/**
 * Removes a single scoped UserRole assignment identified by its id.
 *
 * Safety checks:
 *   - The row must exist, belong to `tenantId`, and have a non-null orgUnitId
 *     (i.e. be a scoped assignment, not a tenant-wide one).
 *   - Removing one scoped assignment never touches other assignments for the same
 *     user, role, or OrgUnit.
 *   - The Club Admin protection (last-admin guard) is irrelevant here: Club Admin
 *     can never be a scoped assignment (assertNotClubAdminRole on write).
 */
export async function removeScopedRoleAssignment(
  input: RemoveScopedRoleInput,
): Promise<RemoveScopedRoleResult> {
  const { tenantId, userRoleId, actorUserId } = input;

  const existing = await prisma.userRole.findFirst({
    where: { id: userRoleId, tenantId, orgUnitId: { not: null } },
    select: {
      id: true,
      userId: true,
      roleId: true,
      orgUnitId: true,
      scopeMode: true,
      role: { select: { name: true, scope: true } },
      orgUnit: { select: { name: true } },
    },
  });

  if (!existing || existing.orgUnitId === null) {
    return { removed: false };
  }

  // Tenant isolation: the row's role must also be TENANT-scoped and owned by tenantId.
  const roleOwnedByTenant = await prisma.role.findFirst({
    where: { id: existing.roleId, scope: "TENANT", tenantId },
    select: { id: true },
  });
  if (!roleOwnedByTenant) {
    throw new RoleValidationError(
      "Die Zuweisung gehört nicht zum aktiven Mandanten.",
    );
  }

  await prisma.userRole.delete({ where: { id: existing.id } });

  await logAction({
    tenantId,
    actorUserId,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "UserRole",
    entityId: existing.id,
    action: "USER_REMOVED",
    beforeJson: {
      tenantId,
      roleId: existing.roleId,
      roleName: existing.role.name,
      userId: existing.userId,
      orgUnitId: existing.orgUnitId,
      orgUnitName: existing.orgUnit?.name ?? null,
      scopeMode: existing.scopeMode,
    },
  });

  return { removed: true };
}
