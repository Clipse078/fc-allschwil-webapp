/**
 * lib/cms/editorial/types.ts
 *
 * Shared normalized types for the Editorial Center (CMS V2 Slice 10).
 *
 * The Editorial Center is an operational view over existing CMS data.
 * It does NOT define new business logic — it normalizes existing entities
 * (HomepageSection, WebsitePageSection, WebsitePage, NewsArticle) into
 * a common shape for dashboard display.
 *
 * All types here are JSON-safe (no Date objects) for RSC→Client transport.
 */

// ── Entity types ──────────────────────────────────────────────────────────────

export type EditorialEntityType =
  | "HomepageSection"
  | "WebsitePageSection"
  | "WebsitePage"
  | "NewsArticle";

export const EDITORIAL_ENTITY_LABEL: Record<EditorialEntityType, string> = {
  HomepageSection: "Homepage-Sektion",
  WebsitePageSection: "Seitenabschnitt",
  WebsitePage: "Seite",
  NewsArticle: "News",
};

// ── KPI counts ────────────────────────────────────────────────────────────────

export type EditorialKpis = {
  /** Total items in DRAFT status (pages + news + sections with publishStatus=DRAFT). */
  drafts: number;
  /** Items awaiting review/approval. */
  inReview: number;
  /** Items with a future scheduled publish date. */
  scheduled: number;
  /** Published items (pages + news + sections with publishStatus=PUBLISHED). */
  published: number;
  /** Archived items (pages + news only — sections have no archive state). */
  archived: number;
  /** Sections whose publishUntil is within the next 7 days. */
  expiringSoon: number;
  /** ContentRevision entries created in the last 24h (activity signal). */
  recentRevisions: number;
};

// ── Unified review queue ──────────────────────────────────────────────────────

export type EditorialQueueItem = {
  id: string;
  entityType: EditorialEntityType;
  title: string;
  /** Approval status for sections. Status for pages/news. */
  workflowStatus: string;
  workflowStatusLabel: string;
  /** publishStatus for sections (DRAFT|PUBLISHED); status for pages/news */
  publishStatus: string;
  publishStatusLabel: string;
  /** ISO string */
  updatedAt: string;
  /** ISO string | null */
  reviewRequestedAt: string | null;
  /** The page title for page sections; null for homepage sections. */
  sourceLocation: string | null;
  editUrl: string;
};

// ── Scheduled publications ────────────────────────────────────────────────────

export type EditorialScheduledItem = {
  id: string;
  entityType: EditorialEntityType;
  title: string;
  /** ISO string | null — the scheduled publish date */
  scheduledAt: string | null;
  /** ISO string | null — optional expiry date (WebsitePageSection only) */
  expiresAt: string | null;
  publishStatus: string;
  publishStatusLabel: string;
  /** The page title for page sections; null for homepage sections. */
  sourceLocation: string | null;
  editUrl: string;
};

// ── Draft overview ────────────────────────────────────────────────────────────

export type EditorialDraftItem = {
  id: string;
  entityType: EditorialEntityType;
  title: string;
  /** ISO string */
  updatedAt: string;
  /** Days since last update */
  ageInDays: number;
  isOld: boolean;  // older than 30 days
  sourceLocation: string | null;
  editUrl: string;
};

// ── Recently changed ──────────────────────────────────────────────────────────

export type EditorialRecentItem = {
  id: string;
  entityType: EditorialEntityType;
  title: string;
  publishStatus: string;
  publishStatusLabel: string;
  /** ISO string */
  changedAt: string;
  actorName: string | null;
  editUrl: string;
};

// ── Activity feed ─────────────────────────────────────────────────────────────

export type EditorialActivityItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actionLabel: string;
  actorName: string | null;
  /** ISO string */
  createdAt: string;
  editUrl: string | null;
};

// ── Content health ────────────────────────────────────────────────────────────

export type ContentHealthIssueType =
  | "old_draft"
  | "disabled_published"
  | "expired_enabled"
  | "page_no_sections"
  | "page_all_disabled"
  | "section_missing_label"
  | "recently_restored";

export type ContentHealthIssueItem = {
  id: string;
  entityType: EditorialEntityType;
  title: string;
  detail: string;
  editUrl: string;
};

export type ContentHealthIssue = {
  type: ContentHealthIssueType;
  /** German label */
  label: string;
  description: string;
  count: number;
  items: ContentHealthIssueItem[];
};

// ── Full overview response ────────────────────────────────────────────────────

export type EditorialOverviewData = {
  kpis: EditorialKpis;
  reviewQueue: EditorialQueueItem[];
  scheduledPublications: EditorialScheduledItem[];
  drafts: EditorialDraftItem[];
  recentlyChanged: EditorialRecentItem[];
  activity: EditorialActivityItem[];
};

export type EditorialHealthData = {
  issues: ContentHealthIssue[];
  totalWarnings: number;
};

// ── Action label helpers ───────────────────────────────────────────────────────

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  APPROVAL_REQUEST: "Zur Prüfung eingereicht",
  APPROVE: "Freigegeben",
  REJECT: "Abgelehnt",
  PUBLISH: "Veröffentlicht",
  UNPUBLISH: "Unveröffentlicht",
  SCHEDULE: "Geplant",
  ARCHIVE: "Archiviert",
  UPDATE: "Aktualisiert",
  CREATE: "Erstellt",
  DELETE: "Gelöscht",
  RESTORE: "Wiederhergestellt",
  SUBMIT_REVIEW: "Zur Prüfung eingereicht",
  REQUEST_CHANGES: "Änderungen angefordert",
};

export function getActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}
