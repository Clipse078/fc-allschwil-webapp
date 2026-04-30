import { NextResponse } from "next/server";
import { getMeetings } from "@/lib/modules/meetings/get-meetings";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import {
  canUserAccess,
  type VisibilityAudience,
} from "@/lib/scoped/resolve-visibility";
import { getCurrentScopedActor } from "@/lib/scoped/get-current-scoped-actor";

function normalizeAudience(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isPublic: true };
  }

  const obj = input as any;

  // PUBLIC
  if (obj.isPublic !== false) {
    return { isPublic: true };
  }

  // PERSONS
  if (Array.isArray(obj.personIds) && obj.personIds.length > 0) {
    return {
      isPublic: false,
      personIds: obj.personIds.filter((id: any) => typeof id === "string"),
    };
  }

  // ROLES
  if (Array.isArray(obj.roleIds) && obj.roleIds.length > 0) {
    return {
      isPublic: false,
      roleIds: obj.roleIds.filter((id: any) => typeof id === "string"),
    };
  }

  return { isPublic: true };
}

function resolveAudience(audience: unknown): VisibilityAudience {
  if (!audience || typeof audience !== "object" || Array.isArray(audience)) {
    return { isPublic: true };
  }

  return audience as VisibilityAudience;
}

export async function GET() {
  const access = await requireApiAnyPermission([
    "vereinsleitung.meetings.view",
  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const meetings = await getMeetings();
    const actor = await getCurrentScopedActor();

    const filtered = meetings.filter((m) =>
      canUserAccess({
        audience: resolveAudience(m.audience),
        userId: actor.personId,
        userRoleIds: actor.roleIds ?? [],
      }),
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Get meetings failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Meetings konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

