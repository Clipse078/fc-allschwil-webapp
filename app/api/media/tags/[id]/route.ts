/**
 * DELETE /api/media/tags/[id] — remove a tag (cascade-removes from all assets).
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { deleteMediaTag } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

type RouteParams = { params: Promise<{ id: string }> };

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
  const ok = await deleteMediaTag(tenantId, id);
  if (!ok) {
    return NextResponse.json({ error: "Tag nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
