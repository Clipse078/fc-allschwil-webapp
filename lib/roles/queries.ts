import { prisma } from "@/lib/db/prisma";

// Explicit interfaces ensure consumers have proper types regardless of
// whether the Prisma client is generated in the local environment.

export type RoleListItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  canAccessVereinsleitung: boolean;
  canAttendVereinsleitungMeetings: boolean;
  createdAt: Date;
  updatedAt: Date;
  userCount: number;
  permissionCount: number;
  orgUnitCount: number;
};

export type RoleUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  assignedAt: Date;
};

export type RoleOrgUnit = {
  id: string;
  name: string;
  key: string;
  type: string;
};

export type RolePermissionItem = {
  id: string;
  key: string;
  name: string;
  module: string;
};

export type RoleDetailItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  canAccessVereinsleitung: boolean;
  canAttendVereinsleitungMeetings: boolean;
  createdAt: Date;
  updatedAt: Date;
  users: RoleUser[];
  orgUnits: RoleOrgUnit[];
  permissions: RolePermissionItem[];
};

export type PermissionWithRoles = {
  id: string;
  key: string;
  name: string;
  module: string;
  roles: { id: string; key: string; name: string }[];
};

export type PermissionModuleGroup = {
  module: string;
  permissions: PermissionWithRoles[];
};

export type PermissionsData = {
  permissions: PermissionWithRoles[];
  moduleGroups: PermissionModuleGroup[];
};

export async function getRolesWithCountsData(): Promise<RoleListItem[]> {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          userRoles: true,
          rolePermissions: true,
        },
      },
      userRoles: {
        select: {
          user: {
            select: {
              orgUnitMemberships: {
                where: { status: "ACTIVE" },
                select: { orgUnitId: true },
              },
            },
          },
        },
      },
    },
  });

  return roles.map((role): RoleListItem => {
    const orgUnitIds = new Set<string>();
    for (const userRole of role.userRoles) {
      for (const membership of userRole.user.orgUnitMemberships) {
        orgUnitIds.add(membership.orgUnitId);
      }
    }
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      canAccessVereinsleitung: role.canAccessVereinsleitung,
      canAttendVereinsleitungMeetings: role.canAttendVereinsleitungMeetings,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
      orgUnitCount: orgUnitIds.size,
    };
  });
}

export async function getRoleDetailData(roleId: string): Promise<RoleDetailItem | null> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      canAccessVereinsleitung: true,
      canAttendVereinsleitungMeetings: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
              orgUnitMemberships: {
                where: { status: "ACTIVE" },
                select: {
                  orgUnit: {
                    select: {
                      id: true,
                      name: true,
                      key: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      rolePermissions: {
        orderBy: { permission: { module: "asc" } },
        select: {
          id: true,
          permission: {
            select: {
              id: true,
              key: true,
              name: true,
              module: true,
            },
          },
        },
      },
    },
  });

  if (!role) return null;

  const orgUnitMap = new Map<string, RoleOrgUnit>();
  for (const userRole of role.userRoles) {
    for (const membership of userRole.user.orgUnitMemberships) {
      orgUnitMap.set(membership.orgUnit.id, {
        id: membership.orgUnit.id,
        name: membership.orgUnit.name,
        key: membership.orgUnit.key,
        type: String(membership.orgUnit.type),
      });
    }
  }

  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    canAccessVereinsleitung: role.canAccessVereinsleitung,
    canAttendVereinsleitungMeetings: role.canAttendVereinsleitungMeetings,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    users: role.userRoles.map((ur): RoleUser => ({
      id: ur.user.id,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      email: ur.user.email,
      isActive: ur.user.isActive,
      assignedAt: ur.createdAt,
    })),
    orgUnits: Array.from(orgUnitMap.values()),
    permissions: role.rolePermissions.map((rp): RolePermissionItem => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
      module: String(rp.permission.module),
    })),
  };
}

export async function getPermissionsWithRoleMappingsData(): Promise<PermissionsData> {
  const perms = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      module: true,
      rolePermissions: {
        select: {
          role: {
            select: {
              id: true,
              key: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const permissions: PermissionWithRoles[] = perms.map((perm): PermissionWithRoles => ({
    id: perm.id,
    key: perm.key,
    name: perm.name,
    module: String(perm.module),
    roles: perm.rolePermissions.map((rp) => ({
      id: rp.role.id,
      key: rp.role.key,
      name: rp.role.name,
    })),
  }));

  const moduleGroups = new Map<string, PermissionWithRoles[]>();
  for (const perm of permissions) {
    const entries = moduleGroups.get(perm.module) ?? [];
    entries.push(perm);
    moduleGroups.set(perm.module, entries);
  }

  return {
    permissions,
    moduleGroups: Array.from(moduleGroups.entries()).map(([module, modulePerms]) => ({
      module,
      permissions: modulePerms,
    })),
  };
}
