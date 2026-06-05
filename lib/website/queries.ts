/**
 * Public Website Feed — Tenant Resolution & Query Layer
 *
 * This module is the single source of truth for:
 *
 *  1. Resolving a tenant for unauthenticated public /api/public/v1/website/* requests.
 *  2. Querying website-gated tenant data with websiteEnabled and approvedDataOnly checks.
 *
 * ─── Tenant resolution order ───────────────────────────────────────────────
 *
 *  a) Host header matched against Tenant.websiteDomain (most precise).
 *  b) ?tenant=<key> query parameter (explicit slug override).
 *  c) Fallback: null → caller returns 404/disabled.
 *
 * This is additive — existing routes (/api/public/events etc.) continue using
 * getDefaultTenant() unchanged. Only the new /api/public/v1/website/* routes
 * use this resolver.
 *
 * ─── Gate checks ────────────────────────────────────────────────────────────
 *
 *  All callers must check websiteEnabled before serving data.
 *  approvedDataOnly is passed through to feed queries so they can filter.
 */

import { prisma } from "@/lib/db/prisma";

// ── Safe public tenant select ─────────────────────────────────────────────────

/** Only non-sensitive fields exposed to public API callers. */
const websiteTenantSelect = {
  id: true,
  key: true,
  name: true,
  status: true,
  websiteDomain: true,
  websiteEnabled: true,
  approvedDataOnly: true,
  // Branding is safe to expose (it's for rendering the public site)
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  locale: true,
  timezone: true,
} as const;

export type WebsiteTenant = {
  id: string;
  key: string;
  name: string;
  status: string;
  websiteDomain: string | null;
  websiteEnabled: boolean;
  approvedDataOnly: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  locale: string | null;
  timezone: string | null;
};

// ── Tenant resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the tenant for a public website feed request.
 *
 * Resolution order:
 *  1. Host header → Tenant.websiteDomain (exact match)
 *  2. ?tenant=<key> query param → Tenant.key
 *
 * Returns null when no tenant can be resolved.
 * Callers are responsible for returning an appropriate 404 response.
 */
export async function resolveTenantForWebsiteFeed(
  host: string | null,
  tenantKeyParam: string | null,
): Promise<WebsiteTenant | null> {
  // 1. Domain-based resolution: strip port if present
  if (host) {
    const domain = host.split(":")[0]?.toLowerCase() ?? null;
    if (domain) {
      const byDomain = await prisma.tenant.findUnique({
        where: { websiteDomain: domain, status: "ACTIVE" },
        select: websiteTenantSelect,
      });
      if (byDomain) return byDomain as WebsiteTenant;
    }
  }

  // 2. Explicit tenant key param
  if (tenantKeyParam) {
    const byKey = await prisma.tenant.findFirst({
      where: { key: tenantKeyParam, status: "ACTIVE" },
      select: websiteTenantSelect,
    });
    if (byKey) return byKey as WebsiteTenant;
  }

  return null;
}

// ── Feed queries ──────────────────────────────────────────────────────────────

/**
 * Fetch public sponsors for a tenant.
 *
 * TODO(website-feed/sponsors): The Sponsor model does not yet exist.
 * Implement once prisma/schema.prisma gains the Sponsor model with:
 *   - tenantId (FK → Tenant)
 *   - name, tier, logoUrl, websiteUrl, sortOrder
 *   - websiteVisible: Boolean
 *   - reviewStage: ReviewWorkflowStage (filter APPROVED/PUBLISHED when approvedDataOnly)
 *
 * Returns a stable empty array until then.
 */
// TODO(website-feed/sponsors): Sponsor model not yet implemented.
// Parameters document the future query signature; ignored until the model ships.
export async function getPublicSponsors(tenantId: string, approvedDataOnly: boolean): Promise<[]> {
  void tenantId;
  void approvedDataOnly;
  // TODO(website-feed/sponsors): replace with real DB query when Sponsor model exists
  return [];
}

/**
 * Fetch public news items for a tenant.
 *
 * TODO(website-feed/news): The News/Article model does not yet exist.
 * Implement once prisma/schema.prisma gains the NewsArticle model with:
 *   - tenantId (FK → Tenant)
 *   - slug, title, summary, bodyMarkdown, publishedAt, imageUrl, category
 *   - websiteVisible: Boolean
 *   - reviewStage: ReviewWorkflowStage (filter APPROVED/PUBLISHED when approvedDataOnly)
 *
 * Returns a stable empty array until then.
 */
// TODO(website-feed/news): NewsArticle model not yet implemented.
// Parameters document the future query signature; ignored until the model ships.
export async function getPublicNews(tenantId: string, approvedDataOnly: boolean, limit: number): Promise<[]> {
  void tenantId;
  void approvedDataOnly;
  void limit;
  // TODO(website-feed/news): replace with real DB query when NewsArticle model exists
  return [];
}
