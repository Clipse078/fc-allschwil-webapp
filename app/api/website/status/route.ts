import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteStatusSummary } from "@/lib/website/queries";

/**
 * GET /api/website/status
 *
 * Returns the full website status summary for the authenticated user's tenant.
 * Requires: website.manage
 * Tenant: resolved from session.user.tenantId (scoped; no cross-tenant access).
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
    const summary = await getWebsiteStatusSummary(tenantId);
    if (!summary) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[api/website/status]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
