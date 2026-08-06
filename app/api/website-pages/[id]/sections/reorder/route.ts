/**
 * PATCH /api/website-pages/[id]/sections/reorder
 *
 * Bulk reorders all sections for a page. Accepts a new ordered array of
 * section IDs; reassigns sortOrder = index * 10.
 *
 * Body: { orderedIds: string[] }
 *
 * All IDs must belong to the page and tenant.
 * Returns the full updated section list.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPageForTenant, reorderPageSections } from "@/lib/page-sections/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const orderedIds = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedIds muss ein String-Array sein." }, { status: 400 });
  }

  const sections = await reorderPageSections(tenantId, pageId, orderedIds as string[]);
  if (!sections) {
    return NextResponse.json(
      { error: "Ungültige Sektions-IDs oder falsche Anzahl." },
      { status: 400 },
    );
  }

  return NextResponse.json({ sections });
}
