import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createInviteToken } from "@/lib/auth/invite";
import { buildInviteUrl, sendInviteMail } from "@/lib/mail/mailer";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logAction } from "@/lib/audit/log-action";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        email: true,
        isActive: true,
        accessState: true,
        userRoles: {
          select: {
            roleId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Inaktive Benutzer können nicht eingeladen werden." },
        { status: 400 }
      );
    }

    if (user.userRoles.length === 0) {
      return NextResponse.json(
        { error: "Vor dem Versand der Einladung muss mindestens eine Rolle zugewiesen werden." },
        { status: 400 }
      );
    }

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    const invite = await createInviteToken({
      userId: user.id,
      createdByUserId: actorUserId,
    });

    const inviteUrl = buildInviteUrl(invite.token);

    await sendInviteMail({
      to: user.email,
      firstName: user.firstName,
      inviteUrl,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessState: "INVITED",
        invitedAt: new Date(),
      },
    });

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "UserInvite",
      entityId: user.id,
      action: "SEND_INVITE",
      afterJson: {
        accessState: "INVITED",
        email: user.email,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      message: "Einladung erfolgreich versendet.",
    });
  } catch (error) {
    console.error("Send invite failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Einladung konnte nicht versendet werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Einladung konnte nicht versendet werden." },
      { status: 500 }
    );
  }
}
