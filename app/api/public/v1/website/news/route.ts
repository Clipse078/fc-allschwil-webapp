/**
 * GET /api/public/v1/website/news
 *
 * Public Website Feed Contract v1 — News Feed
 *
 * Returns the tenant's published news articles, ordered by publishedAt descending.
 *
 * ─── Authentication ──────────────────────────────────────────────────────────
 *   None. Unauthenticated GET only.
 *
 * ─── Query params ────────────────────────────────────────────────────────────
 *   tenant  – tenant key (required if host resolution is not configured)
 *   limit   – max items returned (default 20, max 50)
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *   1. Host header matched against Tenant.websiteDomain
 *   2. ?tenant=<key> query param
 *
 * ─── Gate checks ─────────────────────────────────────────────────────────────
 *   websiteEnabled must be true.
 *   approvedDataOnly: when true, only APPROVED/PUBLISHED articles are included.
 *
 * ─── Source model status ─────────────────────────────────────────────────────
 *   The NewsArticle Prisma model does not yet exist.
 *   This endpoint returns a stable empty array with a TODO marker.
 *   See lib/website/queries.ts → getPublicNews() for the full spec.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *   Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantForWebsiteFeed, getPublicNews } from "@/lib/website/queries";
import {
  jsonFeedResponse,
  tenantNotFoundResponse,
  websiteDisabledResponse,
  internalErrorResponse,
} from "@/lib/website/response-builder";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const host = request.headers.get("host");
    const { searchParams } = new URL(request.url);
    const tenantKeyParam = searchParams.get("tenant");
    const limit = parseLimit(searchParams.get("limit"));

    const tenant = await resolveTenantForWebsiteFeed(host, tenantKeyParam);

    if (!tenant) {
      return tenantNotFoundResponse();
    }

    if (!tenant.websiteEnabled) {
      return websiteDisabledResponse(tenant.key);
    }

    const news = await getPublicNews(tenant.id, tenant.approvedDataOnly, limit);

    return jsonFeedResponse(tenant, news, {
      count: news.length,
      todos: [
        "TODO(website-feed/news): NewsArticle model not yet implemented — returns stable empty array. Implement NewsArticle model in prisma/schema.prisma and update lib/website/queries.ts → getPublicNews().",
      ],
    });
  } catch (error) {
    console.error("[/api/public/v1/website/news] Error:", error);
    return internalErrorResponse(
      error instanceof Error ? error.message : "News feed unavailable.",
    );
  }
}
