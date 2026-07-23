/**
 * Publishing Center — CMS editorial types.
 *
 * Unified across NewsArticle and WebsitePage so the cockpit can
 * render both content types in a single table without duplicating
 * status/label/style logic.
 */

export type PublishableContentType = "news" | "page";

export type PublishingStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";

export type FilterContentType = "ALL" | PublishableContentType;
export type FilterStatus = "ALL" | PublishingStatus;

export type PublishableItem = {
  id: string;
  type: PublishableContentType;
  title: string;
  slug: string;
  status: PublishingStatus;
  /** Resolved display name: authorPerson displayName/fullName or authorName string. */
  authorDisplay: string | null;
  /** ISO-8601 string (JSON-serializable). */
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  /** Deep-link to the item's edit page. */
  editHref: string;
};

export type PublishingStatusCounts = {
  DRAFT: number;
  IN_REVIEW: number;
  SCHEDULED: number;
  PUBLISHED: number;
  ARCHIVED: number;
  total: number;
};

export type PublishingOverviewResponse = {
  items: PublishableItem[];
  counts: {
    all: PublishingStatusCounts;
    news: PublishingStatusCounts;
    pages: PublishingStatusCounts;
  };
  context: {
    approvedDataOnly: boolean;
    canManageNews: boolean;
    canManagePages: boolean;
  };
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

// ── Status display helpers ─────────────────────────────────────────────────────

export const PUBLISHING_STATUS_LABEL: Record<PublishingStatus, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

export const PUBLISHING_STATUS_BADGE_CLASS: Record<PublishingStatus, string> = {
  DRAFT: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  SCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ARCHIVED: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-60",
};

export const PUBLISHING_STATUS_CARD: Record<
  PublishingStatus,
  { cardBg: string; countColor: string; borderColor: string }
> = {
  DRAFT: {
    cardBg: "bg-[var(--surface)]",
    countColor: "text-[var(--foreground)]",
    borderColor: "border-[var(--border)]",
  },
  IN_REVIEW: {
    cardBg: "bg-blue-50",
    countColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  SCHEDULED: {
    cardBg: "bg-amber-50",
    countColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  PUBLISHED: {
    cardBg: "bg-emerald-50",
    countColor: "text-emerald-700",
    borderColor: "border-emerald-200",
  },
  ARCHIVED: {
    cardBg: "bg-[var(--surface-2)]",
    countColor: "text-[var(--muted)]",
    borderColor: "border-[var(--border)]",
  },
};

export const CONTENT_TYPE_LABEL: Record<PublishableContentType, string> = {
  news: "News",
  page: "Seite",
};
