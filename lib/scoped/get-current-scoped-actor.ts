import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function getCurrentScopedActor() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      userId: null,
      personId: null,
      roleIds: [],
      roleKeys: [],
      permissionKeys: [],
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      personId: true,
      userRoles: {
        select: {
          roleId: true,
          role: {
            select: {
              key: true,
            },
          },
        },
      },
    },
  });

  return {
    userId: session.user.id,
    personId: user?.personId ?? null,
    roleIds: user?.userRoles.map((userRole) => userRole.roleId) ?? [],
    roleKeys: user?.userRoles.map((userRole) => userRole.role.key) ?? [],
    permissionKeys: session.user.permissionKeys ?? [],
  };
}
