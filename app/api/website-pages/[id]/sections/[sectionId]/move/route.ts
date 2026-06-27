/**
 * PATCH /api/website-pages/[id]/sections/[sectionId]/move
 *
 * Moves a section up or down within the page's ordered section list.
 * Returns the full updated section list after the swap.
 *
 * Body: { direction: "up" | "down" }
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; page + section ownership verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getPageForTenant,
  movePageSection,
} from "@/lib/page-sections/admin-queries";

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id: pageId, sectionId } = await params;

  const page = await getPageForTenant(tenantId, pageId);
  if (!page) {
    return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const direction = body.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json(
      { error: "direction muss 'up' oder 'down' sein." },
      { status: 400 },
    );
  }

  const sections = await movePageSection(tenantId, pageId, sectionId, direction);
  if (!sections) {
    return NextResponse.json({ error: "Sektion nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ sections });
}
