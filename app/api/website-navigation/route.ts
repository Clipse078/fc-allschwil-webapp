/**
 * GET /api/website-navigation
 * Returns both MAIN and FOOTER navigation groups with all items (admin, all visibility states).
 *
 * Auto-creates groups if they don't exist yet (idempotent upsert).
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAllNavGroupsAdmin } from "@/lib/navigation/admin-queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const navigation = await getAllNavGroupsAdmin(tenantId);
  return NextResponse.json({ navigation });
}
