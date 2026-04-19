import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
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

    const tokenResult = await consumePasswordResetToken(token);

    if (!tokenResult.ok) {
      return NextResponse.json({ error: tokenResult.error }, { status: 400 });
    }

    const resetRecord = tokenResult.record;

    if (!resetRecord.user.isActive) {
      return NextResponse.json(
        { error: "Der Benutzer ist inaktiv." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.user.id },
        data: {
          passwordHash,
          accessState: "ACTIVE",
          passwordSetAt: new Date(),
        },
      }),
      prisma.userToken.update({
        where: { id: resetRecord.id },
        data: {
          consumedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      message: "Passwort erfolgreich gesetzt. Du kannst dich jetzt einloggen.",
    });
  } catch (error) {
    console.error("Complete password reset failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Passwort konnte nicht gesetzt werden: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Passwort konnte nicht gesetzt werden." },
      { status: 500 }
    );
  }
}