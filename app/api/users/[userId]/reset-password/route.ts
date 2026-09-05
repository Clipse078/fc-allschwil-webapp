import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import {
  PlatformAccountDomainError,
  resetPlatformAccountPassword,
} from "@/lib/users/platform-account-service";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { userId } = await context.params;
    const body = await request.json();
    const password = String(body.password ?? "").trim();

    if (!password || password.length < 12) {
      return NextResponse.json(
        { error: "Das neue Passwort muss mindestens 12 Zeichen haben." },
        { status: 400 }
      );
    }

    await resetPlatformAccountPassword({
      userId,
      password,
      actorUserId: access.actorUserId,
    });

    return NextResponse.json({
      message: "Passwort erfolgreich zurueckgesetzt.",
    });
  } catch (error) {
    if (error instanceof PlatformAccountDomainError) {
      const status = error.code === "USER_NOT_FOUND" ? 404 : 409;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    console.error("Reset password failed:", error);

    return NextResponse.json(
      { error: "Passwort konnte nicht zurueckgesetzt werden." },
      { status: 500 }
    );
  }
}