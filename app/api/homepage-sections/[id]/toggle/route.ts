/**
 * PATCH /api/homepage-sections/[id]/toggle
 *
 * Toggles the isEnabled flag for a single homepage section.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session; section ownership verified in query layer.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { toggleHomepageSectionEnabled } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const updated = await toggleHomepageSectionEnabled(tenantId, id);
  if (!updated) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ section: updated });
}
