import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import {
  PlatformAccountDomainError,
  updatePlatformAccount,
} from "@/lib/users/platform-account-service";
import { auditRejectedPrivilegedAction } from "@/lib/audit/security-events";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isActive: user.isActive,
    roles: user.userRoles.map((userRole) => ({
      id: userRole.role.id,
      key: userRole.role.key,
      name: userRole.role.name,
    })),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive (boolean) ist erforderlich." },
        { status: 400 }
      );
    }

    const updatedUser = await updatePlatformAccount({
      userId,
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      isActive: body.isActive,
      actorUserId: access.actorUserId,
    });

    return NextResponse.json({
      id: updatedUser.id,
      message: "Benutzer erfolgreich aktualisiert.",
    });
  } catch (error) {
    if (error instanceof PlatformAccountDomainError) {
      const { userId } = await context.params;
      await auditRejectedPrivilegedAction({
        actorUserId: access.actorUserId,
        tenantId: null,
        action: "PLATFORM_ACCOUNT_UPDATE_REJECTED",
        entityType: "User",
        entityId: userId,
        reasonCode: error.code,
      });
      const status =
        error.code === "USER_NOT_FOUND"
          ? 404
          : error.code === "EMAIL_TAKEN"
            ? 409
            : error.code === "LAST_SUPER_ADMIN"
              ? 409
              : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    console.error("Update user failed:", error);

    return NextResponse.json(
      { error: "Benutzer konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}