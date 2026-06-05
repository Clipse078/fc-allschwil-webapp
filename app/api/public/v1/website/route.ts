/**
 * GET /api/public/v1/website
 *
 * Returns basic website info for the default tenant.
 * Used by the FC Allschwil website to confirm the feed is live.
 *
 * - Unauthenticated GET only; all other methods return 405.
 * - Returns websiteEnabled=false (not a 404) when the tenant exists but the
 *   website feed has not been enabled — lets consumer distinguish "not found"
 *   from "feed disabled".
 */

import { NextResponse } from "next/server";
import { getDefaultTenant } from "@/lib/tenants/queries";
import { getTenantWebsiteConfig } from "@/lib/website/queries";
import { buildWebsiteResponse } from "@/lib/website/response-builder";
import type { WebsiteInfoResponse } from "@/lib/website/response-types";

export async function GET() {
  try {
    const tenant = await getDefaultTenant();

    if (!tenant) {
      return NextResponse.json(
        buildWebsiteResponse<WebsiteInfoResponse>({
          tenantName: "",
          websiteEnabled: false,
        }),
        { status: 404 },
      );
    }

    const config = await getTenantWebsiteConfig(tenant.id);

    return NextResponse.json(
      buildWebsiteResponse<WebsiteInfoResponse>({
        tenantName: config?.name ?? tenant.name,
        websiteEnabled: config?.websiteEnabled ?? false,
      }),
    );
  } catch (error) {
    console.error("GET /api/public/v1/website failed:", error);
    return NextResponse.json(
      { error: "Website feed unavailable." },
      { status: 500 },
    );
  }
}

export function POST() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export function PUT() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export function PATCH() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "GET" } });
}
