/**
 * GET /api/homepage-blocks/preview
 *
 * Returns all non-ARCHIVED homepage blocks for the authenticated tenant,
 * including DRAFT and IN_REVIEW content — ordered by sortOrder.
 *
 * This endpoint is for the admin preview only and must NEVER be exposed
 * to the public. Only authenticated users with WEBSITE_MANAGE can access it.
 *
 * Permission: WEBSITE_MANAGE
 */

import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listHomepageBlocksPreview } from "@/lib/homepage-blocks/admin-queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const blocks = await listHomepageBlocksPreview(tenantId);

  return NextResponse.json({ blocks });
}
