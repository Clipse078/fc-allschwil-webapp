/**
 * GET /api/editorial/overview
 *
 * Returns the full Editorial Center payload:
 *   - KPI counts
 *   - Unified review queue
 *   - Scheduled publications
 *   - Draft overview
 *   - Recently changed content
 *   - Editorial activity feed
 *
 * Permission: WEBSITE_MANAGE required.
 * Tenant isolation: tenantId from session — never from request params.
 *
 * CMS V2 Slice 10 — Editorial Center
 * Reuses existing publishing engine, revision engine, and audit log.
 * No duplicate logic introduced.
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getEditorialOverview } from "@/lib/cms/editorial/queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session?.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const data = await getEditorialOverview(tenantId);

  return NextResponse.json(data);
}
