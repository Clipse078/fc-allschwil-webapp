/**
 * GET    /api/media/[id]  — fetch one media asset (active or archived).
 * PATCH  /api/media/[id]  — update metadata (altText, caption, description, copyright, photographer, folderId, tagIds).
 * DELETE /api/media/[id]  — soft-archive the asset (does not delete blob).
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 * Isolation:  tenantId resolved from session — no cross-tenant access.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getMediaAssetById, updateMediaAsset, archiveMediaAsset } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/media/[id] ───────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const asset = await getMediaAssetById(tenantId, id, includeArchived);
  if (!asset) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ asset });
}

// ── PATCH /api/media/[id] ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const getString = (key: string) =>
    typeof body[key] === "string"
      ? (body[key] as string).trim() || null
      : body[key] === null
        ? null
        : undefined;

  const updated = await updateMediaAsset(tenantId, id, {
    altText:      getString("altText"),
    caption:      getString("caption"),
    description:  getString("description"),
    copyright:    getString("copyright"),
    photographer: getString("photographer"),
    folderId:     body.folderId === null ? null :
                  typeof body.folderId === "string" ? body.folderId : undefined,
    tagIds: Array.isArray(body.tagIds)
      ? (body.tagIds as unknown[]).filter((t): t is string => typeof t === "string")
      : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ asset: updated });
}

// ── DELETE /api/media/[id] ────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const ok = await archiveMediaAsset(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
