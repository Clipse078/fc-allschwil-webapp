import { prisma } from "@/lib/db/prisma";

/**
 * Returns all TenantMembership records for the given tenant, enriched with
 * user account data, tenant-scoped role assignments, linked Person, and
 * invitation state.
 *
 * Tenant isolation: `tenantId` MUST originate from the authenticated session
 * (`session.user.activeTenantId`), never from client input.
 *
 * Security: passwordHash, reset tokens, and session data are never selected.
 */
export async function getTenantUsersListData(tenantId: string) {
  const now = new Date();

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { user: { lastName: "asc" } }],
    select: {
      isActive: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          userRoles: {
            where: { tenantId },
            select: {
              orgUnitId: true,
              role: {
                select: { id: true, name: true, key: true },
              },
              orgUnit: {
                select: { name: true },
              },
            },
          },
          // Person linkage
          person: {
            where: { tenantId },
            select: { id: true, firstName: true, lastName: true },
          },
          // Active invitation token (isInvitation=true, not yet used, not expired)
          passwordResetTokens: {
            where: {
              isInvitation: true,
              usedAt: null,
              expiresAt: { gt: now },
            },
            select: { id: true, expiresAt: true },
            take: 1,
          },
        },
      },
    },
  });

  return memberships.map((m) => {
    const hasLinkedPerson = m.user.person !== null;
    // Pending invitation is determined solely by the presence of an active
    // (non-expired, non-used) invitation token — NOT by lastLoginAt.
    // A user may have an existing global account (lastLoginAt set) and still
    // receive a new tenant invitation (multi-tenant: same User, new tenant).
    const pendingInvitation = m.user.passwordResetTokens.length > 0;

    return {
      userId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      name: `${m.user.firstName} ${m.user.lastName}`,
      email: m.user.email,
      userIsActive: m.user.isActive,
      membershipIsActive: m.isActive,
      joinedAt: m.joinedAt,
      lastLoginAt: m.user.lastLoginAt ?? null,
      roles: m.user.userRoles
        .filter((ur) => ur.orgUnitId === null)
        .map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          key: ur.role.key,
        })),
      scopedRoles: m.user.userRoles
        .filter((ur) => ur.orgUnitId !== null)
        .map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          orgUnitName: ur.orgUnit?.name ?? "",
        })),
      linkedPersonId: hasLinkedPerson ? (m.user.person as { id: string }).id : null,
      linkedPersonName: hasLinkedPerson
        ? `${(m.user.person as { firstName: string; lastName: string }).firstName} ${(m.user.person as { firstName: string; lastName: string }).lastName}`
        : null,
      pendingInvitation,
    };
  });
}

export type TenantUserItem = Awaited<ReturnType<typeof getTenantUsersListData>>[number];

/**
 * Returns all Persons in the given tenant that have no linked User account.
 * These are the "Person only / no account" entries shown in the admin list.
 *
 * Tenant isolation: `tenantId` MUST originate from the authenticated session.
 */
export async function getTenantPersonsWithoutUser(tenantId: string) {
  const persons = await prisma.person.findMany({
    where: { tenantId, userId: null, isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  return persons.map((p) => ({
    personId: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    name: `${p.firstName} ${p.lastName}`,
    email: p.email ?? null,
  }));
}

export type TenantPersonWithoutUser = Awaited<ReturnType<typeof getTenantPersonsWithoutUser>>[number];

export async function getUsersListData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.firstName + " " + user.lastName,
    email: user.email,
    isActive: user.isActive,
    roles: user.userRoles.map((userRole) => userRole.role.name),
  }));
}

export async function getUserDetailData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              key: true,
              name: true,
              // RPERM-05-C1: scope/tenant surfaced so callers (the user
              // detail page) can split platform-editable roles from
              // tenant roles, which are read-only summaries here — see
              // getPlatformRolesListData() and app/api/users/[userId]/roles.
              scope: true,
              tenant: { select: { id: true, key: true, name: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * RPERM-05-C1 (Finding 3): the platform user-role form
 * (`components/admin/users/UserRolesForm.tsx`) may only ever offer
 * PLATFORM-scoped roles — a tenant role must never even be a selectable
 * option here, since `/api/users/[userId]/roles` now rejects tenant role
 * ids server-side. Tenant role management lives exclusively in the
 * RPERM-05 tenant administration module
 * (`/dashboard/administration/roles`).
 *
 * RPERM-04: still excludes archived roles and template roles (e.g. the
 * PLATFORM club_admin template) — templates are never directly
 * assignable; only their per-tenant materialized roles (see
 * prisma/seed.ts) are, and those are TENANT-scoped anyway.
 */
/**
 * Returns the TenantMembership + User data for a single user within a tenant,
 * including linked Person and invitation state.
 *
 * Tenant isolation: `tenantId` MUST originate from the authenticated session
 * (`session.user.activeTenantId`), never from client input.
 *
 * Returns `null` when the user is not a member of the given tenant — callers
 * must treat `null` as a 404/notFound, not as a permission error.
 *
 * Security: passwordHash, reset tokens content, and session data are never selected.
 */
export async function getTenantUserDetail(tenantId: string, userId: string) {
  const now = new Date();

  return prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      id: true,
      isActive: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          userRoles: {
            where: { tenantId, orgUnitId: null },
            select: {
              role: {
                select: { id: true, name: true, key: true },
              },
            },
          },
          // Person linkage
          person: {
            where: { tenantId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          // Invitation state (active token only)
          passwordResetTokens: {
            where: {
              isInvitation: true,
              usedAt: null,
              expiresAt: { gt: now },
            },
            select: { id: true, expiresAt: true },
            take: 1,
          },
        },
      },
    },
  });
}

export type TenantUserDetail = NonNullable<Awaited<ReturnType<typeof getTenantUserDetail>>>;

export async function getPlatformRolesListData() {
  return prisma.role.findMany({
    where: { scope: "PLATFORM", isArchived: false, isTemplate: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      updatedAt: true,
    },
  });
}
