/**
 * Public Website Feed Contract v1 — Shared Response Types
 *
 * These types define the canonical wire format for all
 * /api/public/v1/website/* endpoints. Every response wraps its
 * payload in the WebsiteFeedResponse<T> envelope so website consumers
 * can rely on a stable outer shape regardless of feed type.
 *
 * ─── Envelope fields ────────────────────────────────────────────────────────
 *
 *   version      – contract version string; bump when breaking changes land.
 *   tenant       – non-sensitive tenant identity (key + name only).
 *   generatedAt  – server-side ISO 8601 timestamp; used for staleness detection.
 *   data         – the actual feed payload (typed per endpoint).
 *   meta         – per-response metadata (counts, caching hints, TODO markers).
 *
 * ─── Caching strategy ───────────────────────────────────────────────────────
 *
 *   Routes set Cache-Control: public, s-maxage=60, stale-while-revalidate=300
 *   Website consumers should treat generatedAt as the freshness anchor.
 *   See docs/public-website-feed-contract-v1.md for full caching guidance.
 */

export const FEED_CONTRACT_VERSION = "v1" as const;

// ── Tenant identity (safe public subset only) ─────────────────────────────────

export type PublicTenantIdentity = {
  /** Unique tenant slug. Used by website to namespace API calls. */
  key: string;
  /** Display name of the club / organisation. */
  name: string;
};

// ── Shared envelope ───────────────────────────────────────────────────────────

export type WebsiteFeedMeta = {
  /** Total items returned in data (if data is an array). Null for non-array payloads. */
  count: number | null;
  /** Human-readable hint on caching behaviour for this endpoint. */
  cacheHint: string;
  /**
   * Array of TODO marker strings when a feed type is not yet implemented
   * (source model missing). Website consumers must handle this gracefully by
   * rendering a stable empty state. Will be absent once fully implemented.
   */
  todos?: string[];
};

export type WebsiteFeedResponse<T> = {
  /** Feed contract version. "v1" for this implementation. */
  version: typeof FEED_CONTRACT_VERSION;
  /** Non-sensitive tenant identity. */
  tenant: PublicTenantIdentity;
  /** ISO 8601 server timestamp when this response was generated. */
  generatedAt: string;
  /** The feed payload. */
  data: T;
  /** Per-response metadata. */
  meta: WebsiteFeedMeta;
};

// ── Feed-specific payload types ───────────────────────────────────────────────

/**
 * Aggregate website overview payload — /api/public/v1/website
 *
 * Returns a high-level summary of all available feeds for this tenant.
 * Website consumers can use this to discover what data is ready.
 */
export type WebsiteOverviewData = {
  feeds: {
    sponsors: FeedStatus;
    news: FeedStatus;
    teams: FeedStatus;
    events: FeedStatus;
    weekplan: FeedStatus;
  };
};

export type FeedStatus = {
  /** Whether this feed has a real implementation (vs. stable empty placeholder). */
  available: boolean;
  /** Canonical URL path for this feed. */
  path: string;
};

/**
 * Sponsor item — /api/public/v1/website/sponsors
 *
 * NOTE: The Sponsor Prisma model does not yet exist (Slice 1 TODO).
 * This type describes the intended wire shape for when it is implemented.
 * The endpoint returns a stable empty array until the model is ready.
 */
export type PublicSponsorItem = {
  id: string;
  name: string;
  tier: "gold" | "silver" | "partner" | "supporter";
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
};

/**
 * News item — /api/public/v1/website/news
 *
 * NOTE: The News/Article Prisma model does not yet exist (Slice 1 TODO).
 * This type describes the intended wire shape for when it is implemented.
 * The endpoint returns a stable empty array until the model is ready.
 */
export type PublicNewsItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  /** ISO 8601 publication date. */
  publishedAt: string;
  /** Optional hero image URL. Null = no image. */
  imageUrl: string | null;
  /** Shallow category label (e.g. "Vereinsnews", "Spielbericht"). */
  category: string | null;
};

// ── Error envelope ────────────────────────────────────────────────────────────

export type WebsiteFeedError = {
  error: string;
  code: "TENANT_NOT_FOUND" | "WEBSITE_DISABLED" | "INTERNAL_ERROR";
};
