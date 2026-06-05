import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteSections } from "@/lib/website/queries";

/**
 * GET /api/website/sections
 *
 * Returns all website sections for the authenticated user's tenant.
 * Requires: website.manage
 * Tenant-scoped: section data is always filtered by session.user.tenantId.
 */
export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found for session user." }, { status: 400 });
  }

  try {
    const sections = await getWebsiteSections(tenantId);
    return NextResponse.json(sections);
  } catch (err) {
    console.error("[api/website/sections]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
