import { prisma } from "@/lib/db/prisma";

export async function getUsersListData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      accessState: true,
      invitedAt: true,
      inviteAcceptedAt: true,
      passwordResetSentAt: true,
      lastLoginAt: true,
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
    accessState: user.accessState,
    invitedAt: user.invitedAt,
    inviteAcceptedAt: user.inviteAcceptedAt,
    passwordResetSentAt: user.passwordResetSentAt,
    lastLoginAt: user.lastLoginAt,
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
      accessState: true,
      invitedAt: true,
      inviteAcceptedAt: true,
      passwordSetAt: true,
      passwordResetSentAt: true,
      lastLoginAt: true,
      userRoles: {
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
}

export async function getRolesListData() {
  return prisma.role.findMany({
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