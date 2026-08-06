/**
 * PATCH /api/homepage-sections/[id]/move
 *
 * Moves a homepage section one position up or down in the sort order.
 *
 * Request body: { "direction": "up" | "down" }
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; section ownership verified in query layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moveHomepageSection } from "@/lib/homepage/admin-queries";

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

  const { id } = await params;

  const sections = await moveHomepageSection(tenantId, id, direction);
  if (!sections) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden, kein Zugriff, oder bereits an der Grenzposition." },
      { status: 404 },
    );
  }

  return NextResponse.json({ sections, meta: { total: sections.length } });
}
