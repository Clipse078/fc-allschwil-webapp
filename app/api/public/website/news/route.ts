/**
 * GET /api/public/website/news
 *
 * Returns a paginated list of published news articles for the public website.
 *
 * Query params:
 *   limit   — max articles to return (default 20, max 100)
 *   offset  — pagination offset (default 0)
 *   tenant  — explicit tenant slug override (for dev/testing)
 *
 * Tenant resolution: X-Tenant-Slug header → ?tenant= param → subdomain → default.
 * Response: { total, articles: PublicNewsSummary[] }
 *
 * No auth required — public endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import { getPublishedNewsPosts } from "@/lib/website/news-queries";
import { addCorsHeaders, handleCorsPreflightPublic } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightPublic(request) ?? new NextResponse(null, { status: 204 });
}

function parseIntParam(value: string | null, def: number, max: number): number {
  if (!value) return def;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return def;
  return Math.min(n, max);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseIntParam(searchParams.get("limit"), 20, 100);
    const offset = parseIntParam(searchParams.get("offset"), 0, 10_000);

    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    const articles = await getPublishedNewsPosts(tenant.id, { limit, offset });

    const response = NextResponse.json({
      total: articles.length,
      limit,
      offset,
      articles,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Public website news feed failed:", error);
    return addCorsHeaders(
      NextResponse.json(
        { error: "News Feed konnte nicht geladen werden." },
        { status: 500 },
      ),
      request,
    );
  }
}
