/**
 * GET /api/reusable-components/[id]/revisions
 *
 * Lists version history for a reusable component.
 * Reuses the existing ContentRevision engine (entityType = "ReusableComponent").
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getReusableComponent } from "@/lib/reusable-components/queries";
import { listRevisions } from "@/lib/cms/revision-engine";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const component = await getReusableComponent(tenantId, id);
  if (!component) {
    return NextResponse.json(
      { error: "Komponente nicht gefunden oder kein Zugriff." },
      { status: 404 },
    );
  }

  const revisions = await listRevisions(tenantId, "ReusableComponent", id);

  return NextResponse.json({ revisions, meta: { total: revisions.length } });
}
