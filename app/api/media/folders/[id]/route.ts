/**
 * PATCH  /api/media/folders/[id] — rename or move a folder.
 * DELETE /api/media/folders/[id] — archive a folder (rejected if non-empty).
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { updateMediaFolder, archiveMediaFolder } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
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

  const data: { name?: string; parentId?: string | null; sortOrder?: number } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.parentId !== undefined) {
    data.parentId = typeof body.parentId === "string" ? body.parentId : null;
  }
  if (typeof body.sortOrder === "number") {
    data.sortOrder = body.sortOrder;
  }

  const folder = await updateMediaFolder(tenantId, id, data);
  if (!folder) {
    return NextResponse.json({ error: "Ordner nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ folder });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  // archiveMediaFolder returns false for two distinct reasons:
  //   1. Folder not found (or already archived) → 404
  //   2. Folder has active children or active assets → 409
  // We distinguish by checking existence first.
  const { prisma } = await import("@/lib/db/prisma");
  const exists = await prisma.mediaFolder.findFirst({
    where: { id, tenantId, archivedAt: null },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Ordner nicht gefunden." }, { status: 404 });
  }

  const ok = await archiveMediaFolder(tenantId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Ordner kann nicht gelöscht werden: er enthält noch aktive Medien oder Unterordner." },
      { status: 409 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
