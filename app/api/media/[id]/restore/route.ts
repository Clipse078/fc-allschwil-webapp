/**
 * POST /api/media/[id]/restore — restore an archived media asset.
 *
 * Permission: NEWS_MANAGE or WEBSITE_MANAGE
 * Isolation:  tenantId resolved from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { restoreMediaAsset } from "@/lib/media/queries";

const MEDIA_PERMISSIONS = [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.WEBSITE_MANAGE];

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiAnyPermission(MEDIA_PERMISSIONS);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;
  const ok = await restoreMediaAsset(tenantId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Mediendatei nicht gefunden oder nicht archiviert." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
