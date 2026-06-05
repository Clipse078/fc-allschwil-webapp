/**
 * Website Feed v1 — Public Response Types
 *
 * These types define the stable public API contract for all
 * /api/public/v1/website/* routes.
 *
 * Rules:
 * - All fields are safe for unauthenticated public consumption.
 * - Internal IDs, tenantId, and audit timestamps are never included.
 * - Envelope shape is fixed; do not change field names in a minor release.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export type WebsiteFeedEnvelope<T> = {
  /** Stable schema version tag — increment only on breaking change. */
  version: "v1";
  /** ISO 8601 timestamp when this response was generated. */
  generatedAt: string;
  data: T;
};

// ---------------------------------------------------------------------------
// Website info (GET /api/public/v1/website)
// ---------------------------------------------------------------------------

export type WebsiteInfoResponse = {
  tenantName: string;
  websiteEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Sponsors (GET /api/public/v1/website/sponsors)
// ---------------------------------------------------------------------------

export type PublicSponsorItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string;
  sortOrder: number;
};

export type SponsorsResponse = {
  count: number;
  sponsors: PublicSponsorItem[];
};

// ---------------------------------------------------------------------------
// News (GET /api/public/v1/website/news)
// ---------------------------------------------------------------------------

export type PublicNewsItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

export type NewsResponse = {
  count: number;
  news: PublicNewsItem[];
};
