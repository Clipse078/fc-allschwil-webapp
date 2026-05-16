import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  const formatted = users.map((user) => ({
    id: user.id,
    name: user.firstName + " " + user.lastName,
    email: user.email,
    isActive: user.isActive,
    roles: user.userRoles.map((ur) => ur.role.name),
  }));

  return NextResponse.json(formatted);
}