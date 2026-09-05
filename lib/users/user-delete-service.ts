/**
 * lib/users/user-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — Global User account permanent hard-delete service.
 *
 * AUTHORIZATION: Platform SCE Super Admin only. Requires `users.delete`
 * (scope=PLATFORM). Club Admins must never call this — they use the tenant
 * membership removal flow (removeTenantMembership) instead.
 *
 * MULTI-TENANT SAFETY: This deletes the global User account, removing
 * TenantMembership + UserRole rows across ALL tenants. Person records that
 * were linked to this User are preserved — Person.userId is nulled (SetNull).
 *
 * SAFETY CHECK: Deleting the last platform super_admin is blocked.
 *
 * CASCADE BEHAVIOR (enforced by Prisma schema onDelete):
 *   • UserRole — Cascade-deleted (across all tenants)
 *   • PasswordResetToken — Cascade-deleted
 *   • TenantMembership — Cascade-deleted (across all tenants)
 *   • AuditLog.actorUserId — Nulled (SetNull — audit trail preserved)
 *   • Registration.assignedToUserId — Nulled (SetNull — registration preserved)
 *   • OrgUnitMembership.userId — Nulled (SetNull — membership preserved)
 *   • Person.userId — Nulled (SetNull — Person data preserved)
 *   • Content review/approval/workspace creator fields — Nulled (SetNull)
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  acquirePlatformSuperAdminMutationLock,
  platformSuperAdminAssignmentWhere,
  usablePlatformSuperAdminWhere,
} from "@/lib/security/platform-superadmin";

export type UserDeletionImpact = {
  /** All tenant memberships across all tenants — will be deleted */
  tenantMemberships: number;
  /** All role assignments (UserRole rows) across all tenants — will be deleted */
  roleAssignments: number;
  /** Whether this user has a linked Person record (Person preserved, userId nulled) */
  hasLinkedPerson: boolean;
  linkedPersonId: string | null;
  linkedPersonName: string | null;
  /** Whether this user holds a platform super_admin role */
  isPlatformSuperAdmin: boolean;
  /** Email of the user being deleted */
  email: string;
  displayName: string;
};

export type UserDeletionBlocker = {
  reason: "LAST_SUPER_ADMIN";
  message: string;
};

export type UserDeletionImpactResult =
  | { blocked: true; blocker: UserDeletionBlocker }
  | { blocked: false; impact: UserDeletionImpact };

export type UserDeletionResult = {
  userId: string;
  email: string;
  displayName: string;
  impact: UserDeletionImpact;
};

type DeletionClient = Pick<PrismaClient, "user" | "userRole">;

async function getUserDeletionImpactWithClient(
  client: DeletionClient,
  userId: string,
): Promise<UserDeletionImpactResult | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      _count: {
        select: {
          userRoles: true,
          tenantMemberships: true,
        },
      },
      person: {
        select: { id: true, firstName: true, lastName: true },
      },
      userRoles: {
        where: platformSuperAdminAssignmentWhere,
        select: { id: true },
      },
    },
  });

  if (!user) return null;

  const isPlatformSuperAdmin = user.userRoles.length > 0;
  if (isPlatformSuperAdmin && user.isActive) {
    const usableSuperAdminCount = await client.userRole.count({
      where: usablePlatformSuperAdminWhere,
    });

    if (usableSuperAdminCount <= 1) {
      return {
        blocked: true,
        blocker: {
          reason: "LAST_SUPER_ADMIN",
          message:
            "Dieser Benutzer ist der einzige aktive SCE Super Admin. " +
            "Weise zunächst einem anderen aktiven Benutzer die Super-Admin-Rolle zu, bevor du diesen Account löschst.",
        },
      };
    }
  }

  return {
    blocked: false,
    impact: {
      tenantMemberships: user._count.tenantMemberships,
      roleAssignments: user._count.userRoles,
      hasLinkedPerson: user.person !== null,
      linkedPersonId: user.person?.id ?? null,
      linkedPersonName: user.person
        ? `${user.person.firstName} ${user.person.lastName}`
        : null,
      isPlatformSuperAdmin,
      email: user.email,
      displayName: `${user.firstName} ${user.lastName}`,
    },
  };
}

/**
 * Returns the deletion impact for a global User account, or a blocker
 * if deletion is not permitted (e.g., last super_admin).
 * Never mutates.
 */
export async function getUserDeletionImpact(
  userId: string,
): Promise<UserDeletionImpactResult | null> {
  return getUserDeletionImpactWithClient(prisma, userId);
}

/**
 * Permanently deletes a global User account.
 *
 * All cascade/SetNull behavior is handled automatically by Prisma schema
 * onDelete policies. No pre-cleanup steps needed.
 *
 * Returns null when the user does not exist (idempotent-safe).
 * Returns a blocker if deletion is not permitted.
 */
export async function deleteUserPermanently(
  userId: string,
): Promise<UserDeletionResult | UserDeletionBlocker | null> {
  return prisma.$transaction(async (tx) => {
    await acquirePlatformSuperAdminMutationLock(tx);
    const impactResult = await getUserDeletionImpactWithClient(tx, userId);
    if (impactResult === null) return null;
    if (impactResult.blocked) return impactResult.blocker;

    const { impact } = impactResult;
    await tx.user.delete({ where: { id: userId } });

    return {
      userId,
      email: impact.email,
      displayName: impact.displayName,
      impact,
    };
  });
}
