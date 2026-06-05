/**
 * GET /api/public/v1/website/sponsors
 *
 * Public Website Feed Contract v1 — Sponsors Feed
 *
 * Returns the tenant's public sponsor list, ordered by tier then sortOrder.
 *
 * ─── Authentication ──────────────────────────────────────────────────────────
 *   None. Unauthenticated GET only.
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *   1. Host header matched against Tenant.websiteDomain
 *   2. ?tenant=<key> query param
 *
 * ─── Gate checks ─────────────────────────────────────────────────────────────
 *   websiteEnabled must be true.
 *   approvedDataOnly: when true, only APPROVED/PUBLISHED sponsors are included.
 *
 * ─── Source model status ─────────────────────────────────────────────────────
 *   The Sponsor Prisma model does not yet exist.
 *   This endpoint returns a stable empty array with a TODO marker.
 *   See lib/website/queries.ts → getPublicSponsors() for the full spec.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *   Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantForWebsiteFeed, getPublicSponsors } from "@/lib/website/queries";
import {
  jsonFeedResponse,
  tenantNotFoundResponse,
  websiteDisabledResponse,
  internalErrorResponse,
} from "@/lib/website/response-builder";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const host = request.headers.get("host");
    const { searchParams } = new URL(request.url);
    const tenantKeyParam = searchParams.get("tenant");

    const tenant = await resolveTenantForWebsiteFeed(host, tenantKeyParam);

    if (!tenant) {
      return tenantNotFoundResponse();
    }

    if (!tenant.websiteEnabled) {
      return websiteDisabledResponse(tenant.key);
    }

    const sponsors = await getPublicSponsors(tenant.id, tenant.approvedDataOnly);

    return jsonFeedResponse(tenant, sponsors, {
      count: sponsors.length,
      todos: [
        "TODO(website-feed/sponsors): Sponsor model not yet implemented — returns stable empty array. Implement Sponsor model in prisma/schema.prisma and update lib/website/queries.ts → getPublicSponsors().",
      ],
    });
  } catch (error) {
    console.error("[/api/public/v1/website/sponsors] Error:", error);
    return internalErrorResponse(
      error instanceof Error ? error.message : "Sponsors feed unavailable.",
    );
  }
}
