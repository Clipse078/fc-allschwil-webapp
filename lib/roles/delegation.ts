import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DelegationForbiddenError } from "@/lib/roles/errors";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";

export type TenantDelegationRequest = {
  tenantId: string;
  actorUserId: string;
  permissionKeys?: readonly string[];
  roleIds?: readonly string[];
};

export function findMissingDelegatedPermissions(
  actorPermissions: readonly string[],
  delegatedPermissions: readonly string[],
): string[] {
  const allowed = new Set(actorPermissions);
  return Array.from(new Set(delegatedPermissions)).filter(
    (permission) => !allowed.has(permission),
  );
}

/**
 * Canonical live delegation boundary for tenant role and invite mutations.
 *
 * The actor must have a current active tenant membership and every delegated
 * permission must be TENANT-scoped, admin-grantable, and currently held by
 * that actor. Role ids are re-resolved with tenant ownership before their
 * permission sets are evaluated. Platform/cross-tenant/unknown inputs are
 * intentionally reported through one fail-closed error.
 */
export async function assertTenantDelegationAllowed(
  request: TenantDelegationRequest,
  db: PrismaClient = prisma,
): Promise<void> {
  const requestedPermissionKeys = Array.from(
    new Set(request.permissionKeys ?? []),
  );
  const requestedRoleIds = Array.from(new Set(request.roleIds ?? []));

  const [permissions, roles, effective] = await Promise.all([
    requestedPermissionKeys.length
      ? db.permission.findMany({
          where: {
            key: { in: requestedPermissionKeys },
            scope: "TENANT",
            grantableByAdmin: true,
          },
          select: { key: true },
        })
      : Promise.resolve([]),
    requestedRoleIds.length
      ? db.role.findMany({
          where: {
            id: { in: requestedRoleIds },
            tenantId: request.tenantId,
            scope: "TENANT",
            isArchived: false,
          },
          select: {
            id: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    key: true,
                    scope: true,
                    grantableByAdmin: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    createEffectivePermissionResolver(db).getEffectivePermissions({
      userId: request.actorUserId,
      tenantId: request.tenantId,
    }),
  ]);

  if (
    permissions.length !== requestedPermissionKeys.length ||
    roles.length !== requestedRoleIds.length
  ) {
    throw new DelegationForbiddenError();
  }

  const delegatedKeys = [
    ...permissions.map((permission) => permission.key),
    ...roles.flatMap((role) =>
      role.rolePermissions.map(({ permission }) => {
        if (
          permission.scope !== "TENANT" ||
          permission.grantableByAdmin !== true
        ) {
          throw new DelegationForbiddenError();
        }
        return permission.key;
      }),
    ),
  ];

  if (
    findMissingDelegatedPermissions(effective.tenant, delegatedKeys).length > 0
  ) {
    throw new DelegationForbiddenError();
  }
}
