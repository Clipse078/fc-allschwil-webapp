/**
 * lib/website/public-cache-tags.ts
 *
 * SCE-CANONICAL-PUBLISHING-01 — generic content domains for tenant-website
 * cache invalidation. Tags are tenant-scoped and passed to external website
 * revalidation endpoints as `sce:{tenantSlug}:{domain}`.
 */

export const PUBLIC_CACHE_DOMAINS = {
  /** Wochenplan / weekplan feed (trainings, matches, tournaments in current week). */
  WEEKPLAN: "weekplan",
  /** Tournament list and /turnierplan surfaces. */
  TOURNAMENTS: "tournaments",
  /** Match schedule surfaces. */
  MATCHES: "matches",
  /** Club directory logos and canonical club identity. */
  CLUBS: "clubs",
  /** News articles and teasers. */
  NEWS: "news",
  /** Sponsor blocks and sponsor data. */
  SPONSORS: "sponsors",
  /** Tenant design system tokens. */
  DESIGN_SYSTEM: "design-system",
  /** Homepage sections and CMS layout. */
  HOMEPAGE: "homepage",
  /** Broad invalidation — use sparingly. */
  ALL: "all",
} as const;

export type PublicCacheDomain = (typeof PUBLIC_CACHE_DOMAINS)[keyof typeof PUBLIC_CACHE_DOMAINS];

const DOMAIN_SET = new Set<string>(Object.values(PUBLIC_CACHE_DOMAINS));

export function isPublicCacheDomain(value: string): value is PublicCacheDomain {
  return DOMAIN_SET.has(value);
}

/**
 * Builds the canonical Next.js revalidation tag for one tenant domain.
 * External tenant websites should register fetch/cache with these tags.
 */
export function buildPublicCacheTag(tenantSlug: string, domain: PublicCacheDomain): string {
  return `sce:${tenantSlug.trim()}:${domain}`;
}

/**
 * Builds all canonical tags for the requested domains.
 */
export function buildPublicCacheTags(
  tenantSlug: string,
  domains: readonly PublicCacheDomain[],
): string[] {
  const slug = tenantSlug.trim();
  const tags = domains.map((domain) => buildPublicCacheTag(slug, domain));
  return [...new Set(tags)];
}
