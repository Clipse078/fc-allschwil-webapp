/**
 * GET /api/public/v1/website/news
 *
 * Returns published news articles for the default tenant.
 * Safe for unauthenticated public consumption.
 *
 * Query params:
 * - limit: number of articles to return (1–100, default 20)
 *
 * Guards:
 * - GET only — all other methods return 405.
 * - websiteEnabled must be true — returns 403 when disabled.
 * - Only publishStatus=PUBLISHED articles are returned.
 * - approvedDataOnly is always enforced (query layer always filters PUBLISHED).
 * - Tenant isolation: always scoped to the resolved default tenant.
 *
 * Response envelope is stable v1 (see lib/website/response-builder.ts).
 * Empty news array is returned (not 404) when no published articles exist.
 * Body/content is excluded from the list feed; a future detail route will
 * expose full body by slug.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultTenant } from "@/lib/tenants/queries";
import { getTenantWebsiteConfig, getPublishedNews } from "@/lib/website/queries";
import { buildWebsiteResponse } from "@/lib/website/response-builder";
import type { NewsResponse } from "@/lib/website/response-types";

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));

    const tenant = await getDefaultTenant();

    if (!tenant) {
      return NextResponse.json(
        buildWebsiteResponse<NewsResponse>({ count: 0, news: [] }),
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

    const news = await getPublishedNews({ tenantId: tenant.id, limit });

    return NextResponse.json(
      buildWebsiteResponse<NewsResponse>({
        count: news.length,
        news,
      }),
    );
  } catch (error) {
    console.error("GET /api/public/v1/website/news failed:", error);
    return NextResponse.json(
      { error: "News feed unavailable." },
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
