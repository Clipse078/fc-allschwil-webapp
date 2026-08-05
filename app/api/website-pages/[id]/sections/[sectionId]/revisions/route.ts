/**
 * GET /api/website-pages/[id]/sections/[sectionId]/revisions
 *
 * Lists version history for a page section.
 * Returns up to 50 revisions, newest first.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPageForTenant, getPageSection } from "@/lib/page-sections/admin-queries";
import { listRevisions } from "@/lib/cms/revision-engine";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId, sectionId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  const section = await getPageSection(tenantId, pageId, sectionId);
  if (!section) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  const revisions = await listRevisions(tenantId, "WebsitePageSection", sectionId);

  return NextResponse.json({ revisions });
}
