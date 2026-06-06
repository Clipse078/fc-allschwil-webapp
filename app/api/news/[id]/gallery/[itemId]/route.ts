/**
 * PATCH  /api/news/[id]/gallery/[itemId]  — update gallery item caption.
 * DELETE /api/news/[id]/gallery/[itemId]  — remove gallery item.
 *
 * Permission: NEWS_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { updateGalleryItemCaption, removeGalleryItem } from "@/lib/news/admin-queries";

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id, itemId } = await params;

  let body: { caption?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const ok = await updateGalleryItemCaption(tenantId, id, itemId, body.caption ?? null);
  if (!ok) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const { id, itemId } = await params;

  const ok = await removeGalleryItem(tenantId, id, itemId);
  if (!ok) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
