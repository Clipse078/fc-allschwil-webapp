import { NextRequest, NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import {
  resolveSessionPermissionKeys,
  resolveTenantMembershipContext,
} from "@/lib/auth/session-context";

export async function POST(_: NextRequest) {
  const session = await auth();

  if (!session?.user || !session.user.isImpersonating || !session.user.actorUserId) {
    return NextResponse.json(
      { error: "Keine aktive Impersonation gefunden." },
      { status: 400 }
    );
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: session.user.actorUserId },
    include: {
      userRoles: {
        select: { role: { select: { key: true } } },
      },
    },
  });

  if (!actorUser || !actorUser.isActive) {
    return NextResponse.json(
      { error: "Originaler Admin nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  const roleKeys = Array.from(new Set(actorUser.userRoles.map((userRole) => userRole.role.key)));

  // RPERM-04: rebuild the restored session through the same tenant-resolution
  // model used at login — see lib/auth/session-context.ts.
  const tenantContext = await resolveTenantMembershipContext(prisma, actorUser.id);
  const permissionKeys = await resolveSessionPermissionKeys(
    prisma,
    actorUser.id,
    tenantContext.activeTenantId,
  );

  await unstable_update({
    user: {
      id: actorUser.id,
      email: actorUser.email,
      firstName: actorUser.firstName,
      lastName: actorUser.lastName,
      roleKeys,
      permissionKeys,
      isImpersonating: false,
      actorUserId: undefined,
      actorEmail: undefined,
      actorName: undefined,
      effectiveUserId: actorUser.id,
      activeTenantId: tenantContext.activeTenantId,
      activeMembershipId: tenantContext.activeMembershipId,
      availableTenants: tenantContext.availableTenants,
    },
  });

  return NextResponse.json({
    message: "Impersonation beendet.",
  });
}