/**
 * POST /api/homepage-sections/[id]/duplicate
 *
 * Creates a copy of a homepage section within the same tenant.
 *
 * The duplicate is created as a DRAFT with isEnabled=false and
 * a label of "{original} (Kopie)", placed immediately after the original
 * in sort order.
 *
 * Returns: { section, sections } — the new section and the full updated list.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { duplicateHomepageSection } from "@/lib/homepage/admin-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  const result = await duplicateHomepageSection(tenantId, id);
  if (result === null) {
    return NextResponse.json(
      { error: "Sektion nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  return NextResponse.json(result, { status: 201 });
}
