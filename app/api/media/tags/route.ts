/**
 * GET  /api/media/tags — list all tags for the session tenant.
 * POST /api/media/tags — create a new tag.
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listMediaTags, createMediaTag } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

export async function GET(_request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const tags = await listMediaTags(tenantId);
  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich." }, { status: 400 });
  }

  const tag = await createMediaTag(tenantId, name);
  if (!tag) {
    return NextResponse.json(
      { error: "Tag konnte nicht erstellt werden. Möglicherweise bereits vorhanden." },
      { status: 409 },
    );
  }

  return NextResponse.json({ tag }, { status: 201 });
}
