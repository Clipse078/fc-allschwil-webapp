/**
 * Public Website Feed — Response Builder
 *
 * Centralises construction of the WebsiteFeedResponse<T> envelope so
 * every /api/public/v1/website/* route produces an identical outer shape.
 *
 * Also provides the canonical Cache-Control header value and the
 * buildDisabledResponse helper for 503 responses when websiteEnabled = false.
 */

import { NextResponse } from "next/server";
import {
  FEED_CONTRACT_VERSION,
  type WebsiteFeedError,
  type WebsiteFeedMeta,
  type WebsiteFeedResponse,
  type PublicTenantIdentity,
} from "./response-types";
import type { WebsiteTenant } from "./queries";

// ── Cache-Control ─────────────────────────────────────────────────────────────

/**
 * Default Cache-Control for public website feed responses.
 *
 *   s-maxage=60          — CDN/proxy caches for 60 s
 *   stale-while-revalidate=300 — serves stale content while refreshing (5 min window)
 *   public               — safe for shared caches (no auth, no sensitive data)
 *
 * Override per-endpoint when fresher or longer TTL is appropriate.
 */
export const WEBSITE_FEED_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";

/** Human-readable cache hint embedded in meta for website consumers. */
export const WEBSITE_FEED_CACHE_HINT =
  "CDN: 60s, stale-while-revalidate: 5min";

// ── Envelope builder ──────────────────────────────────────────────────────────

export function buildFeedResponse<T>(
  tenant: WebsiteTenant,
  data: T,
  meta: Omit<WebsiteFeedMeta, "cacheHint"> & { cacheHint?: string },
): WebsiteFeedResponse<T> {
  const identity: PublicTenantIdentity = {
    key: tenant.key,
    name: tenant.name,
  };

  return {
    version: FEED_CONTRACT_VERSION,
    tenant: identity,
    generatedAt: new Date().toISOString(),
    data,
    meta: {
      count: meta.count,
      cacheHint: meta.cacheHint ?? WEBSITE_FEED_CACHE_HINT,
      ...(meta.todos && meta.todos.length > 0 ? { todos: meta.todos } : {}),
    },
  };
}

// ── Standard NextResponse helpers ─────────────────────────────────────────────

export function jsonFeedResponse<T>(
  tenant: WebsiteTenant,
  data: T,
  meta: Omit<WebsiteFeedMeta, "cacheHint"> & { cacheHint?: string },
  status = 200,
): NextResponse {
  const body = buildFeedResponse(tenant, data, meta);
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": WEBSITE_FEED_CACHE_CONTROL,
    },
  });
}

export function tenantNotFoundResponse(): NextResponse {
  const body: WebsiteFeedError = {
    error: "Tenant not found or not resolvable from this request.",
    code: "TENANT_NOT_FOUND",
  };
  return NextResponse.json(body, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export function websiteDisabledResponse(tenantKey: string): NextResponse {
  const body: WebsiteFeedError = {
    error: `Website feed is not enabled for tenant '${tenantKey}'.`,
    code: "WEBSITE_DISABLED",
  };
  return NextResponse.json(body, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function internalErrorResponse(message: string): NextResponse {
  const body: WebsiteFeedError = {
    error: message,
    code: "INTERNAL_ERROR",
  };
  return NextResponse.json(body, {
    status: 500,
    headers: { "Cache-Control": "no-store" },
  });
}
