import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { startImpersonationSession } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logSecurityAction } from "@/lib/audit/log-action";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(_: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_IMPERSONATE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const session = access.session;

  const { userId } = await context.params;

  if (session.user.isImpersonating) {
    await logSecurityAction({
      actorUserId: session.user.actorUserId ?? session.user.id,
      effectiveUserId: session.user.effectiveUserId ?? session.user.id,
      tenantId: session.user.activeTenantId,
      moduleKey: "security",
      entityType: "User",
      entityId: userId,
      action: "IMPERSONATION_START_REJECTED",
      outcome: "DENIED",
      metadataJson: { reasonCode: "NESTED_IMPERSONATION" },
    });
    return NextResponse.json(
      { error: "Eine aktive Impersonation muss zuerst beendet werden." },
      { status: 400 },
    );
  }

  if ((session.user.effectiveUserId ?? session.user.id) === userId) {
    return NextResponse.json(
      { error: "Dieser Benutzer ist bereits aktiv." },
      { status: 400 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  const actorUserId = session.user.actorUserId ?? session.user.id;
  await logSecurityAction({
    actorUserId,
    tenantId: session.user.activeTenantId,
    moduleKey: "security",
    entityType: "User",
    entityId: targetUser.id,
    action: "IMPERSONATION_START_REQUESTED",
    metadataJson: { effectiveUserId: targetUser.id },
  });
  const updatedSession = await startImpersonationSession(actorUserId, targetUser.id);

  if (
    !updatedSession?.user.isImpersonating ||
    updatedSession.user.actorUserId !== actorUserId ||
    updatedSession.user.effectiveUserId !== targetUser.id
  ) {
    return NextResponse.json(
      { error: "Impersonation konnte nicht sicher hergestellt werden." },
      { status: 409 },
    );
  }

  await logSecurityAction({
    actorUserId,
    tenantId: updatedSession.user.activeTenantId,
    moduleKey: "users",
    entityType: "User",
    entityId: targetUser.id,
    action: "impersonation_started",
    metadataJson: {
      actorUserId,
      effectiveUserId: targetUser.id,
    },
  });

  return NextResponse.json({
    message: "Impersonation gestartet.",
  });
}