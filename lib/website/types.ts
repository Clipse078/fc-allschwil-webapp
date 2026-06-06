/**
 * Shared types for the /api/public/v1/website/* feed endpoints.
 *
 * Design invariants:
 * - WebsiteResponseEnvelope<T> is the single envelope wrapper for all website API responses.
 * - Article types are split: list items never expose content/body (bandwidth + security).
 * - Only safe, website-facing fields are declared here; internal DB fields stay in lib/news/.
 * - Workflow/review fields (status, reviewNotes, etc.) are never exposed publicly.
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
 */
export type WebsiteResponseEnvelope<T> = {
  version: string;
  tenant: WebsiteEnvelopeTenant;
  generatedAt: string;
  data: T;
  meta: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Shared media snippet
// ---------------------------------------------------------------------------

export type PublicMediaSnippet = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
};

export type PublicAdditionalMediaItem = {
  id: string;
  sortOrder: number;
  caption: string | null;
  placement: string | null;
  mediaAsset: {
    id: string;
    url: string;
    filename: string;
    altText: string | null;
    type: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  };
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
  heroMedia: PublicMediaSnippet | null;
};

// ---------------------------------------------------------------------------
// News article — detail (includes content/body and all media)
// ---------------------------------------------------------------------------

/**
 * Safe article fields exposed on the detail endpoint.
 * Includes content/body, hero media, and additional gallery media.
 * Only returned for PUBLISHED articles with publishedAt <= now.
 */
export type PublicNewsArticleDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  publishedAt: Date;
  heroMedia: PublicMediaSnippet | null;
  additionalMedia: PublicAdditionalMediaItem[];
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
