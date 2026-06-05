import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteConfig, updateWebsiteConfig } from "@/lib/website/queries";

/**
 * GET /api/website/config
 *
 * Returns the website config for the authenticated user's tenant.
 * Requires: website.manage
 * Tenant-scoped.
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
    const config = await getWebsiteConfig(tenantId);
    if (!config) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }
    return NextResponse.json(config);
  } catch (err) {
    console.error("[api/website/config GET]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * PATCH /api/website/config
 *
 * Updates the website config for the authenticated user's tenant.
 * Accepts: websiteDomain (string | null), websiteEnabled (boolean), approvedDataOnly (boolean)
 * Requires: website.manage
 * Tenant-scoped.
 */
export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found for session user." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { websiteDomain, websiteEnabled, approvedDataOnly } = body;

  // Validate
  if (websiteDomain !== undefined && websiteDomain !== null && typeof websiteDomain !== "string") {
    return NextResponse.json({ error: "websiteDomain must be a string or null." }, { status: 400 });
  }
  if (websiteEnabled !== undefined && typeof websiteEnabled !== "boolean") {
    return NextResponse.json({ error: "websiteEnabled must be a boolean." }, { status: 400 });
  }
  if (approvedDataOnly !== undefined && typeof approvedDataOnly !== "boolean") {
    return NextResponse.json({ error: "approvedDataOnly must be a boolean." }, { status: 400 });
  }

  // Simple domain validation: no spaces, no protocol prefix
  if (typeof websiteDomain === "string" && websiteDomain.trim()) {
    const domain = websiteDomain.trim();
    if (/\s/.test(domain) || domain.startsWith("http")) {
      return NextResponse.json(
        { error: "websiteDomain must be a hostname without protocol (e.g. www.fc-allschwil.ch)." },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await updateWebsiteConfig(tenantId, {
      websiteDomain: typeof websiteDomain === "string" ? (websiteDomain.trim() || null) : websiteDomain as null | undefined,
      websiteEnabled: typeof websiteEnabled === "boolean" ? websiteEnabled : undefined,
      approvedDataOnly: typeof approvedDataOnly === "boolean" ? approvedDataOnly : undefined,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[api/website/config PATCH]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
