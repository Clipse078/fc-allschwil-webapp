import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getMeetings } from "@/lib/modules/meetings/get-meetings";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import {
  canUserAccess,
  type VisibilityAudience,
} from "@/lib/scoped/resolve-visibility";
import { getCurrentScopedActor } from "@/lib/scoped/get-current-scoped-actor";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAudience(input: unknown): VisibilityAudience {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { isPublic: true };
  }

  const obj = input as {
    isPublic?: unknown;
    personIds?: unknown;
    roleIds?: unknown;
  };

  if (obj.isPublic !== false) {
    return { isPublic: true };
  }

  if (Array.isArray(obj.personIds) && obj.personIds.length > 0) {
    return {
      isPublic: false,
      personIds: obj.personIds.filter((id): id is string => typeof id === "string"),
      roleIds: [],
    };
  }

  if (Array.isArray(obj.roleIds) && obj.roleIds.length > 0) {
    return {
      isPublic: false,
      personIds: [],
      roleIds: obj.roleIds.filter((id): id is string => typeof id === "string"),
    };
  }

  return { isPublic: true };
}

function resolveAudience(audience: unknown): VisibilityAudience {
  return normalizeAudience(audience);
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

export async function POST(request: Request) {
  const access = await requireApiAnyPermission([
    "vereinsleitung.meetings.manage",  ]);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Titel ist erforderlich." },
        { status: 400 },
      );
    }

    const audience = normalizeAudience(body.audience);
    const baseSlug = slugify(title) || "meeting";
    const slug = `${baseSlug}-${Date.now()}`;

    const meeting = await prisma.vereinsleitungMeeting.create({
      data: {
        title,
        slug,
        subtitle: typeof body.subtitle === "string" ? body.subtitle : null,
        description:
          typeof body.description === "string" ? body.description : null,
        scopeType: typeof body.scopeType === "string" ? body.scopeType : null,
        scopeId: typeof body.scopeId === "string" ? body.scopeId : null,
        audience,
      } as any,
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Create meeting failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Meeting konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

