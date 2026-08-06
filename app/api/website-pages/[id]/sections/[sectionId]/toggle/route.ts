/**
 * PATCH /api/website-pages/[id]/sections/[sectionId]/toggle
 *
 * Toggles the isEnabled flag of a page section.
 * Disabled sections are hidden from the public layout API.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; page + section ownership verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPageForTenant,
  togglePageSection,
} from "@/lib/page-sections/admin-queries";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
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

  const section = await togglePageSection(tenantId, pageId, sectionId);
  if (!section) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ section });
}
