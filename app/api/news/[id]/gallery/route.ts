/**
 * GET  /api/news/[id]/gallery  — list gallery items for an article.
 * POST /api/news/[id]/gallery  — add a media asset to the article gallery.
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getNewsArticleAdminById, addGalleryItem } from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id } = await params;
  const article = await getNewsArticleAdminById(tenantId, id);
  if (!article) return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });

  return NextResponse.json({ gallery: article.galleryMedia });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id } = await params;

  let body: { mediaAssetId?: string; caption?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.mediaAssetId || typeof body.mediaAssetId !== "string") {
    return NextResponse.json({ error: "mediaAssetId ist erforderlich." }, { status: 422 });
  }

  const item = await addGalleryItem(tenantId, id, body.mediaAssetId, body.caption ?? null);
  if (!item) return NextResponse.json({ error: "Artikel oder Medien nicht gefunden." }, { status: 404 });

  return NextResponse.json({ item }, { status: 201 });
}
