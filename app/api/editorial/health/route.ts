/**
 * GET /api/editorial/health
 *
 * Returns content health check issues for the Editorial Center.
 * Health checks are separated from the main overview for performance:
 * some checks are more expensive and can load progressively.
 *
 * Permission: WEBSITE_MANAGE required.
 * Tenant isolation: tenantId from session — never from request params.
 *
 * CMS V2 Slice 10 — Editorial Center
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getContentHealthIssues } from "@/lib/cms/editorial/queries";

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

  const data = await getContentHealthIssues(tenantId);

  return NextResponse.json(data);
}
