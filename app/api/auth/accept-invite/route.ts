import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { consumeInviteToken } from "@/lib/auth/invite";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
        { status: 400 }
      );
    }

    const tokenResult = await consumeInviteToken(token);

    if (!tokenResult.ok) {
      return NextResponse.json({ error: tokenResult.error }, { status: 400 });
    }

    const inviteRecord = tokenResult.record;

    if (!inviteRecord.user.isActive) {
      return NextResponse.json(
        { error: "Der Benutzer ist inaktiv." },
        { status: 400 }
      );
    }

    if (inviteRecord.user.userRoles.length === 0) {
      return NextResponse.json(
        { error: "Der Benutzer hat noch keine Rolle. Bitte Admin kontaktieren." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: inviteRecord.user.id },
        data: {
          passwordHash,
          accessState: "ACTIVE",
          inviteAcceptedAt: new Date(),
          passwordSetAt: new Date(),
        },
      }),
      prisma.userToken.update({
        where: { id: inviteRecord.id },
        data: {
          consumedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      message: "Einladung erfolgreich angenommen. Du kannst dich jetzt einloggen.",
    });
  } catch (error) {
    console.error("Accept invite failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Einladung konnte nicht angenommen werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Einladung konnte nicht angenommen werden." },
      { status: 500 }
    );
  }
}