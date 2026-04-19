import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import {
  buildPasswordResetUrl,
  isLogMailMode,
  sendPasswordResetMail,
} from "@/lib/mail/mailer";
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
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Inaktive Benutzer können keinen Reset-Link erhalten." },
        { status: 400 }
      );
    }

    const actorUserId =
      access.session?.user?.effectiveUserId ??
      access.session?.user?.id ??
      null;

    const reset = await createPasswordResetToken({
      userId: user.id,
      createdByUserId: actorUserId,
    });

    const resetUrl = buildPasswordResetUrl(reset.token);

    await sendPasswordResetMail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetSentAt: new Date(),
      },
    });

    await logAction({
      actorUserId,
      moduleKey: "users",
      entityType: "UserPasswordReset",
      entityId: user.id,
      action: "SEND_RESET",
      afterJson: {
        email: user.email,
        expiresAt: reset.expiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      message: "Reset-Link erfolgreich versendet.",
      debugUrl: isLogMailMode() ? resetUrl : null,
      debugMode: isLogMailMode(),
    });
  } catch (error) {
    console.error("Send password reset failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Reset-Link konnte nicht versendet werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Reset-Link konnte nicht versendet werden." },
      { status: 500 }
    );
  }
}