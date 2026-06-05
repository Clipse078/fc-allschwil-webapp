/**
 * GET /api/public/v1/website/sponsors
 *
 * Returns active, published sponsors for the default tenant.
 * Safe for unauthenticated public consumption.
 *
 * Guards:
 * - GET only — all other methods return 405.
 * - websiteEnabled must be true — returns 403 when disabled.
 * - Only publishStatus=PUBLISHED AND isActive=true sponsors are returned.
 * - approvedDataOnly is always enforced (query layer always filters PUBLISHED).
 * - Tenant isolation: always scoped to the resolved default tenant.
 *
 * Response envelope is stable v1 (see lib/website/response-builder.ts).
 * Empty sponsors array is returned (not 404) when no published sponsors exist.
 */

import { NextResponse } from "next/server";
import { getDefaultTenant } from "@/lib/tenants/queries";
import { getTenantWebsiteConfig, getPublishedSponsors } from "@/lib/website/queries";
import { buildWebsiteResponse } from "@/lib/website/response-builder";
import type { SponsorsResponse } from "@/lib/website/response-types";

export async function GET() {
  try {
    const tenant = await getDefaultTenant();

    if (!tenant) {
      return NextResponse.json(
        buildWebsiteResponse<SponsorsResponse>({ count: 0, sponsors: [] }),
        { status: 404 },
      );
    }

    const config = await getTenantWebsiteConfig(tenant.id);

    if (!config?.websiteEnabled) {
      return NextResponse.json(
        { error: "Website feed is not enabled for this tenant." },
        { status: 403 },
      );
    }

    const sponsors = await getPublishedSponsors(tenant.id);

    return NextResponse.json(
      buildWebsiteResponse<SponsorsResponse>({
        count: sponsors.length,
        sponsors,
      }),
    );
  } catch (error) {
    console.error("GET /api/public/v1/website/sponsors failed:", error);
    return NextResponse.json(
      { error: "Sponsors feed unavailable." },
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
