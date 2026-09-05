import { NextResponse } from "next/server";
import { auth, stopImpersonationSession } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { logSecurityAction } from "@/lib/audit/log-action";

export async function POST() {
  const session = await auth();

  if (!session?.user || !session.user.isImpersonating || !session.user.actorUserId) {
    return NextResponse.json(
      { error: "Keine aktive Impersonation gefunden." },
      { status: 400 }
    );
  }

  const actorUser = await prisma.user.findUnique({
    where: { id: session.user.actorUserId },
    select: { id: true, isActive: true },
  });

  if (!actorUser || !actorUser.isActive) {
    return NextResponse.json(
      { error: "Originaler Admin nicht gefunden oder inaktiv." },
      { status: 404 }
    );
  }

  await logSecurityAction({
    actorUserId: actorUser.id,
    effectiveUserId: session.user.effectiveUserId ?? session.user.id,
    tenantId: session.user.activeTenantId,
    moduleKey: "security",
    entityType: "User",
    entityId: session.user.effectiveUserId ?? session.user.id,
    action: "IMPERSONATION_STOP_REQUESTED",
  });
  const updatedSession = await stopImpersonationSession(actorUser.id);

  if (
    !updatedSession?.user ||
    updatedSession.user.isImpersonating ||
    updatedSession.user.actorUserId !== actorUser.id ||
    updatedSession.user.effectiveUserId !== actorUser.id
  ) {
    return NextResponse.json(
      { error: "Impersonation konnte nicht sicher beendet werden." },
      { status: 409 },
    );
  }

  await logSecurityAction({
    actorUserId: actorUser.id,
    tenantId: updatedSession.user.activeTenantId,
    moduleKey: "users",
    entityType: "User",
    entityId: session.user.effectiveUserId ?? session.user.id,
    action: "impersonation_stopped",
    metadataJson: {
      actorUserId: actorUser.id,
      effectiveUserId: session.user.effectiveUserId ?? session.user.id,
    },
  });

  return NextResponse.json({
    message: "Impersonation beendet.",
  });
}