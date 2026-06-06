/**
 * GET    /api/news/[id]/media               — list additional media for an article.
 * POST   /api/news/[id]/media               — add a media asset to an article.
 * DELETE /api/news/[id]/media?assetId=...   — remove a media asset from an article.
 * PATCH  /api/news/[id]/media               — reorder media (body: { orderedIds: string[] }).
 *
 * These manage the NewsArticleMedia join table (additional media, separate from heroMediaId).
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listArticleMedia,
  addArticleMedia,
  removeArticleMedia,
  reorderArticleMedia,
} from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET /api/news/[id]/media ──────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: articleId } = await params;
  const media = await listArticleMedia(tenantId, articleId);
  return NextResponse.json({ media });
}

// ── POST /api/news/[id]/media ─────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: articleId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const mediaAssetId =
    typeof body.mediaAssetId === "string" ? body.mediaAssetId.trim() : "";
  if (!mediaAssetId) {
    return NextResponse.json({ error: "mediaAssetId ist erforderlich." }, { status: 400 });
  }

  const caption =
    typeof body.caption === "string" ? body.caption.trim() || null : null;
  const placement =
    typeof body.placement === "string" ? body.placement.trim() || null : null;

  const item = await addArticleMedia({
    tenantId,
    articleId,
    mediaAssetId,
    caption,
    placement,
  });

  if (!item) {
    return NextResponse.json(
      { error: "Artikel oder Mediendatei nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({ item }, { status: 201 });
}

// ── DELETE /api/news/[id]/media?assetId=... ───────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: articleId } = await params;
  const { searchParams } = new URL(request.url);
  const mediaAssetId = searchParams.get("assetId") ?? "";

  if (!mediaAssetId) {
    return NextResponse.json({ error: "assetId query-Parameter fehlt." }, { status: 400 });
  }

  const ok = await removeArticleMedia(tenantId, articleId, mediaAssetId);
  if (!ok) {
    return NextResponse.json(
      { error: "Medieneintrag nicht gefunden." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}

// ── PATCH /api/news/[id]/media (reorder) ─────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: articleId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const orderedIds = Array.isArray(body.orderedIds)
    ? (body.orderedIds as string[]).filter((x) => typeof x === "string")
    : null;

  if (!orderedIds || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds ist erforderlich." }, { status: 400 });
  }

  await reorderArticleMedia(tenantId, articleId, orderedIds);
  const media = await listArticleMedia(tenantId, articleId);
  return NextResponse.json({ media });
}
