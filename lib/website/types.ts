/**
 * Shared types for the /api/public/v1/website/* feed endpoints.
 *
 * Design invariants:
 * - WebsiteResponseEnvelope<T> is the single envelope wrapper for all website API responses.
 * - Article types are split: list items never expose content/body (bandwidth + security).
 * - Only safe, website-facing fields are declared here; internal DB fields stay in lib/news/.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export type WebsiteEnvelopeTenant = {
  /** Tenant URL-safe key, e.g. "fc-allschwil". */
  key: string;
  /** Human-readable display name, e.g. "FC Allschwil". */
  name: string;
};

/**
 * Standard response envelope for all /api/public/v1/website/* endpoints.
 *
 * version     — API contract version. Bump when shape changes are breaking.
 * tenant      — Identifies which tenant's data this response contains.
 * generatedAt — ISO 8601 UTC timestamp of response generation.
 * data        — Endpoint-specific payload (typed via T).
 * meta        — Endpoint-specific pagination / count metadata.
 */
export type WebsiteResponseEnvelope<T> = {
  version: string;
  tenant: WebsiteEnvelopeTenant;
  generatedAt: string;
  data: T;
  meta: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// News article — list item (no content/body)
// ---------------------------------------------------------------------------

/**
 * Safe article fields exposed on the list endpoint.
 * content/body is intentionally absent to keep list responses lightweight.
 */
export type PublicNewsArticleListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date;
};

// ---------------------------------------------------------------------------
// News article — detail (includes content/body)
// ---------------------------------------------------------------------------

/**
 * Safe article fields exposed on the detail endpoint.
 * Includes content/body. Only returned for PUBLISHED articles.
 */
export type PublicNewsArticleDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  publishedAt: Date;
};

// ---------------------------------------------------------------------------
// Endpoint-specific data shapes
// ---------------------------------------------------------------------------

export type NewsListData = {
  articles: PublicNewsArticleListItem[];
};

export type NewsDetailData = {
  article: PublicNewsArticleDetail;
};
