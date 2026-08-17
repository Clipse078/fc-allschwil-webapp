/**
 * lib/roles/role-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — Role permanent hard-delete service.
 *
 * Design principles:
 *   • Only TENANT-scoped, non-system roles may be permanently deleted.
 *     System roles (isSystem=true) are protected and blocked unconditionally.
 *   • PLATFORM-scoped roles are never deletable through this service
 *     (they are managed by the platform seed / super_admin and should never
 *     be destroyed at the tenant level).
 *   • UserRole assignments cascade on Role delete (onDelete: Cascade).
 *   • RolePermission, RoleWorkflowRule, RoleWorkflowReviewAssignment — all cascade.
 *   • If active users hold this role, the impact shows the count but does NOT block.
 *     Admins are expected to reassign before deleting a role with active members.
 *     (Matches the pattern used for other entities: impact is informational, not a hard block.)
 */

import { prisma } from "@/lib/db/prisma";

export type RoleDeletionImpact = {
  /** Active users who currently hold this role — their UserRole rows will be cascade-deleted */
  activeUserCount: number;
  /** Total UserRole rows (including inactive tenants) — all cascade-deleted */
  totalUserRoleCount: number;
  /** Permission assignments — cascade-deleted */
  permissionCount: number;
  /** Workflow rules — cascade-deleted */
  workflowRuleCount: number;
};

export type RoleDeletionBlocker = {
  reason: "SYSTEM_ROLE" | "PLATFORM_ROLE" | "WRONG_TENANT";
  message: string;
};

export type RoleDeletionImpactResult =
  | { blocked: true; blocker: RoleDeletionBlocker }
  | { blocked: false; impact: RoleDeletionImpact };

export type RoleDeletionResult = {
  roleId: string;
  roleName: string;
  roleKey: string;
  impact: RoleDeletionImpact;
};

/**
 * Returns the deletion impact for a Role, or a blocker if deletion is not permitted.
 * Never mutates.
 */
export async function getRoleDeletionImpact(
  tenantId: string,
  roleId: string,
): Promise<RoleDeletionImpactResult | null> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      tenantId: true,
      scope: true,
      isSystem: true,
      name: true,
      key: true,
      _count: {
        select: {
          userRoles: true,
          rolePermissions: true,
          workflowRules: true,
        },
      },
    },
  });

  if (!role) return null;

  // Only allow deletion of roles owned by this exact tenant
  if (role.tenantId !== tenantId) {
    return {
      blocked: true,
      blocker: {
        reason: "WRONG_TENANT",
        message: "Rolle nicht gefunden.",
      },
    };
  }

  // Block PLATFORM-scoped roles
  if (role.scope === "PLATFORM") {
    return {
      blocked: true,
      blocker: {
        reason: "PLATFORM_ROLE",
        message: "Plattform-Rollen können nicht über das Mandanten-Interface gelöscht werden.",
      },
    };
  }

  // Block system roles
  if (role.isSystem) {
    return {
      blocked: true,
      blocker: {
        reason: "SYSTEM_ROLE",
        message:
          `„${role.name}" ist eine geschützte Systemrolle und kann nicht endgültig gelöscht werden. ` +
          "Systemrollen sind unveränderliche Kernbestandteile des Berechtigungsmodells.",
      },
    };
  }

  // Count active users (users with active membership in this tenant who have this role)
  const activeUserCount = await prisma.userRole.count({
    where: {
      roleId,
      tenantId,
      user: {
        tenantMemberships: { some: { tenantId, isActive: true } },
      },
    },
  });

  return {
    blocked: false,
    impact: {
      activeUserCount,
      totalUserRoleCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
      workflowRuleCount: role._count.workflowRules,
    },
  };
}

/**
 * Permanently deletes a Role within the given tenant.
 *
 * All cascade behavior (UserRole, RolePermission, RoleWorkflowRule,
 * RoleWorkflowReviewAssignment) is handled by Prisma schema onDelete: Cascade.
 *
 * Returns null when the role does not exist (idempotent-safe).
 * Returns a blocker when deletion is not permitted.
 */
export async function deleteRolePermanently(
  tenantId: string,
  roleId: string,
): Promise<RoleDeletionResult | RoleDeletionBlocker | null> {
  const impactResult = await getRoleDeletionImpact(tenantId, roleId);
  if (impactResult === null) return null;
  if (impactResult.blocked) return impactResult.blocker;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, key: true },
  });

  if (!role) return null;

  await prisma.role.delete({ where: { id: roleId } });

  return {
    roleId,
    roleName: role.name,
    roleKey: role.key,
    impact: impactResult.impact,
  };
}
