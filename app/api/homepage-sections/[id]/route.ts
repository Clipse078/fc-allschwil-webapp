/**
 * DELETE /api/homepage-sections/[id]
 *
 * Permanently deletes a homepage section.
 *
 * Safety: section ownership is verified in the query layer (tenant-scoped).
 * Published sections can be deleted — the caller (UI) should confirm first.
 *
 * Returns: { sections: HomepageSectionAdminItem[] } — full updated list.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { deleteHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const sections = await deleteHomepageSection(tenantId, id);
  if (sections === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json({ sections });
}
