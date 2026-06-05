/**
 * GET /api/public/v1/website
 *
 * Public Website Feed Contract v1 — Aggregate Overview Endpoint
 *
 * Returns tenant identity and a discovery map of available feed endpoints.
 * Website consumers should call this first to determine which feeds are live
 * vs. returning stable empty placeholders.
 *
 * ─── Authentication ──────────────────────────────────────────────────────────
 *   None. Unauthenticated GET only.
 *   Non-GET methods return 405.
 *
 * ─── Tenant resolution ───────────────────────────────────────────────────────
 *   1. Host header matched against Tenant.websiteDomain
 *   2. ?tenant=<key> query param
 *
 * ─── Gate checks ─────────────────────────────────────────────────────────────
 *   websiteEnabled must be true, otherwise 503.
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *   Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantForWebsiteFeed } from "@/lib/website/queries";
import {
  jsonFeedResponse,
  tenantNotFoundResponse,
  websiteDisabledResponse,
  internalErrorResponse,
} from "@/lib/website/response-builder";
import type { WebsiteOverviewData } from "@/lib/website/response-types";

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

    const data: WebsiteOverviewData = {
      feeds: {
        sponsors: {
          available: false,
          path: "/api/public/v1/website/sponsors",
        },
        news: {
          available: false,
          path: "/api/public/v1/website/news",
        },
        teams: {
          available: false,
          path: "/api/public/v1/website/teams",
        },
        events: {
          available: true,
          path: "/api/public/events",
        },
        weekplan: {
          available: true,
          path: "/api/public/wochenplan",
        },
      },
    };

    return jsonFeedResponse(tenant, data, {
      count: null,
      todos: [
        "TODO(website-feed/sponsors): available=true once Sponsor model is implemented",
        "TODO(website-feed/news): available=true once NewsArticle model is implemented",
        "TODO(website-feed/teams): available=true once team feed endpoint is implemented",
      ],
    });
  } catch (error) {
    console.error("[/api/public/v1/website] Error:", error);
    return internalErrorResponse(
      error instanceof Error ? error.message : "Website feed unavailable.",
    );
  }
}
