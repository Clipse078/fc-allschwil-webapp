/**
 * Homepage Blocks V1 — shared types.
 *
 * WebsiteBlock holds content definition + review workflow.
 * WebsiteBlockInstance holds placement (pageContext, sortOrder, enabled).
 *
 * Config JSON is typed at the application layer per block type.
 * Internal fields (tenantId, reviewNotes) are never leaked to public APIs.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type WebsiteBlockType =
  | "HERO"
  | "RICH_TEXT"
  | "NEWS"
  | "UPCOMING_MATCHES"
  | "SPONSORS"
  | "CTA"
  | "GALLERY";

export type WebsiteBlockStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type WebsitePageContext = "HOMEPAGE";

// ── Block config shapes (per type) ────────────────────────────────────────────

export type HeroBlockConfig = {
  headline: string;
  subheadline?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  backgroundMediaId?: string | null;
  backgroundMediaUrl?: string | null;
  backgroundMediaAlt?: string | null;
};

export type RichTextBlockConfig = {
  bodyTitle?: string | null;
  text: string;
  imageMediaId?: string | null;
  imageMediaUrl?: string | null;
  imageMediaAlt?: string | null;
};

export type NewsBlockConfig = {
  showCount: number;
  featuredOnly?: boolean;
};

export type UpcomingMatchesBlockConfig = {
  showCount: number;
};

export type SponsorEntry = {
  name: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
};

export type SponsorsBlockConfig = {
  displayStyle: "grid" | "list";
  showCount: number;
  sponsors: SponsorEntry[];
};

export type CtaBlockConfig = {
  ctaTitle: string;
  description?: string | null;
  buttonLabel: string;
  buttonUrl: string;
};

export type GalleryMediaItem = {
  id: string;
  url: string;
  altText: string | null;
  filename: string;
};

export type GalleryBlockConfig = {
  mediaIds: string[];
  mediaItems: GalleryMediaItem[];
};

export type AnyBlockConfig =
  | HeroBlockConfig
  | RichTextBlockConfig
  | NewsBlockConfig
  | UpcomingMatchesBlockConfig
  | SponsorsBlockConfig
  | CtaBlockConfig
  | GalleryBlockConfig;

// ── Default config per block type ─────────────────────────────────────────────

export function defaultConfigForType(type: WebsiteBlockType): AnyBlockConfig {
  switch (type) {
    case "HERO":
      return { headline: "" };
    case "RICH_TEXT":
      return { text: "" };
    case "NEWS":
      return { showCount: 3, featuredOnly: false };
    case "UPCOMING_MATCHES":
      return { showCount: 5 };
    case "SPONSORS":
      return { displayStyle: "grid", showCount: 10, sponsors: [] };
    case "CTA":
      return { ctaTitle: "", buttonLabel: "", buttonUrl: "" };
    case "GALLERY":
      return { mediaIds: [], mediaItems: [] };
  }
}

// ── Admin list / detail shapes ────────────────────────────────────────────────

export type BlockInstanceSummary = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  pageContext: WebsitePageContext;
};

export type HomepageBlockAdminItem = {
  id: string;
  type: WebsiteBlockType;
  status: WebsiteBlockStatus;
  title: string;
  config: AnyBlockConfig;
  reviewNotes: string | null;
  publishedAt: string | null; // ISO
  scheduledAt: string | null; // ISO
  createdAt: string;
  updatedAt: string;
  instance: BlockInstanceSummary | null;
};

// ── Public API shapes ─────────────────────────────────────────────────────────

export type PublicBlockItem = {
  id: string;
  type: WebsiteBlockType;
  sortOrder: number;
  config: AnyBlockConfig;
};

// ── Display helpers ───────────────────────────────────────────────────────────

export const BLOCK_TYPE_LABEL: Record<WebsiteBlockType, string> = {
  HERO: "Hero",
  RICH_TEXT: "Rich Text",
  NEWS: "News",
  UPCOMING_MATCHES: "Nächste Spiele",
  SPONSORS: "Sponsoren",
  CTA: "CTA",
  GALLERY: "Galerie",
};

export const BLOCK_STATUS_LABEL: Record<WebsiteBlockStatus, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

export const BLOCK_STATUS_BADGE_CLASS: Record<WebsiteBlockStatus, string> = {
  DRAFT: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ARCHIVED: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-60",
};
