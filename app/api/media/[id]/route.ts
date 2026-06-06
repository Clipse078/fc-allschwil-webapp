/**
 * GET    /api/media/[id]  — fetch one media asset.
 * PATCH  /api/media/[id]  — update altText / caption.
 * DELETE /api/media/[id]  — soft-archive the asset (does not delete blob).
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId resolved from session — no cross-tenant access.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getMediaAssetById, updateMediaAsset, archiveMediaAsset } from "@/lib/media/queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/media/[id] ───────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const asset = await getMediaAssetById(tenantId, id);
  if (!asset) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ asset });
}

// ── PATCH /api/media/[id] ─────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
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

  const updated = await updateMediaAsset(tenantId, id, {
    altText: typeof body.altText === "string" ? body.altText.trim() || null : undefined,
    caption: typeof body.caption === "string" ? body.caption.trim() || null : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "Mediendatei nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ asset: updated });
}

// ── DELETE /api/media/[id] ────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
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
