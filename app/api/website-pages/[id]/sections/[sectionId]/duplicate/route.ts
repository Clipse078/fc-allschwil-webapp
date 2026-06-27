/**
 * POST /api/website-pages/[id]/sections/[sectionId]/duplicate
 *
 * Duplicates a page section. The copy is appended at the end of the page
 * with isEnabled=false and publishStatus=DRAFT so it does not immediately go live.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPageForTenant, duplicatePageSection } from "@/lib/page-sections/admin-queries";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const actorUserId = access.session.user?.id ?? null;
  const { id: pageId, sectionId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const section = await duplicatePageSection(tenantId, pageId, sectionId, actorUserId);
  if (!section) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ section }, { status: 201 });
}
