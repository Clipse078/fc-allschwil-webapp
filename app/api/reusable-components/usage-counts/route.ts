/**
 * GET /api/reusable-components/usage-counts?ids=id1,id2,id3
 *
 * Returns usage counts for a batch of component IDs in a single query.
 * Used by the library list view to avoid N+1 per-component requests.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getComponentUsageCounts } from "@/lib/reusable-components/queries";

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);

  if (ids.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  const counts = await getComponentUsageCounts(tenantId, ids);
  return NextResponse.json({ counts });
}
