/**
 * Shared response helpers for /api/public/v1/website/* endpoints.
 *
 * Centralises:
 *   - Envelope construction (buildWebsiteEnvelope)
 *   - Tenant resolution from HTTP request (resolveTenantFromRequest)
 *   - Website-disabled guard (assertWebsiteEnabled)
 *
 * All website feed routes MUST use these helpers to keep envelope shape
 * consistent and avoid duplicating tenant-resolution logic.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  getActiveTenantForWebsiteFeed,
  getDefaultTenantForWebsiteFeed,
  type WebsiteFeedTenant,
} from "@/lib/tenants/queries";
import type {
  WebsiteEnvelopeTenant,
  WebsiteResponseEnvelope,
} from "@/lib/website/types";

// Re-export for convenience so route files have a single import point.
export type { WebsiteFeedTenant };

// ---------------------------------------------------------------------------
// Envelope builder
// ---------------------------------------------------------------------------

/**
 * Wraps endpoint-specific data in the standard website response envelope.
 *
 * @param tenant     - Tenant key + name used as identity in the envelope.
 * @param data       - Endpoint-specific payload (typed via T).
 * @param meta       - Endpoint-specific metadata (counts, pagination, filters).
 */
export function buildWebsiteEnvelope<T>(
  tenant: WebsiteEnvelopeTenant,
  data: T,
  meta: Record<string, unknown> = {}
): WebsiteResponseEnvelope<T> {
  return {
    version: "1",
    tenant: { key: tenant.key, name: tenant.name },
    generatedAt: new Date().toISOString(),
    data,
    meta,
  };
}

// ---------------------------------------------------------------------------
// Tenant resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the active tenant for a public website feed request.
 *
 * Resolution order:
 *   1. X-Tenant-Slug request header — explicit override (multi-tenant ready).
 *   2. Default tenant fallback — single-tenant path (current FC Allschwil setup).
 *
 * Returns null when no active tenant can be resolved.
 *
 * The returned tenant includes websiteEnabled and approvedDataOnly so callers
 * can gate access without an additional DB round-trip.
 *
 * TODO(tenant-isolation/website): extend to support subdomain / custom domain
 * resolution once the domain→tenant mapping table is introduced.
 */
export async function resolveTenantFromRequest(
  request: NextRequest
): Promise<WebsiteFeedTenant | null> {
  const headerSlug = request.headers.get("X-Tenant-Slug");

  if (headerSlug) {
    return getActiveTenantForWebsiteFeed(headerSlug);
  }

  return getDefaultTenantForWebsiteFeed();
}

/**
 * Resolves the active tenant for a public website feed request using a
 * path-segment tenant slug (e.g. from `/api/public/[tenant]/website/*` routes).
 *
 * Returns null when the tenant does not exist or is not ACTIVE.
 * Callers MUST return 404 when this returns null.
 */
export async function resolveTenantFromParams(
  tenantSlug: string,
): Promise<WebsiteFeedTenant | null> {
  return getActiveTenantForWebsiteFeed(tenantSlug);
}

// ---------------------------------------------------------------------------
// Website-enabled guard
// ---------------------------------------------------------------------------

/**
 * Returns a 403 NextResponse when the tenant has disabled website integration,
 * or null when the endpoint may proceed.
 *
 * Usage in route handlers:
 *
 *   const guard = assertWebsiteEnabled(tenant);
 *   if (guard) return guard;
 */
export function assertWebsiteEnabled(
  tenant: Pick<WebsiteFeedTenant, "websiteEnabled">
): NextResponse | null {
  if (!tenant.websiteEnabled) {
    return NextResponse.json(
      { error: "Website integration is not enabled for this tenant." },
      { status: 403 }
    );
  }

  return null;
}
