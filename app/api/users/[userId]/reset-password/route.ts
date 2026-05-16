import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();
    const password = String(body.password ?? "").trim();

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Das neue Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    return NextResponse.json({
      message: "Passwort erfolgreich zurueckgesetzt.",
    });
  } catch (error) {
    console.error("Reset password failed:", error);

    return NextResponse.json(
      { error: "Passwort konnte nicht zurueckgesetzt werden." },
      { status: 500 }
    );
  }
}