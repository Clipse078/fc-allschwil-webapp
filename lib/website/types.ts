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
// Endpoint-specific data shapes — News
// ---------------------------------------------------------------------------

export type NewsListData = {
  articles: PublicNewsArticleListItem[];
};

export type NewsDetailData = {
  article: PublicNewsArticleDetail;
};

// ---------------------------------------------------------------------------
// Public event — website-safe shape (no internal admin/workflow fields)
//
// Intentionally omits: visibility flags, pitchCode, dressing-room codes,
// remarks, sortOrder, tenantId, status internal workflow fields.
// ---------------------------------------------------------------------------

export type PublicWebsiteEventItem = {
  id: string;
  title: string;
  /** EventType enum value: MATCH | TOURNAMENT | TRAINING | OTHER | VACATION_PERIOD */
  type: string;
  /** EventStatus: SCHEDULED | LIVE | COMPLETED | POSTPONED */
  status: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  description: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  /** HOME | AWAY | NEUTRAL — null for non-match events */
  homeAway: string | null;
  /** e.g. "2:1" — null until result is entered */
  resultLabel: string | null;
  /** Meeting/warm-up time, null when not set */
  meetingTime: Date | null;
  team: {
    id: string;
    name: string;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
  } | null;
  season: {
    key: string;
    name: string;
  };
};

export type EventsData = {
  events: PublicWebsiteEventItem[];
};

export type MatchesData = {
  matches: PublicWebsiteEventItem[];
};

// ---------------------------------------------------------------------------
// Public team — website-safe shape
//
// Intentionally omits: isActive, websiteVisible, infoboardVisible, orgUnitId,
// sortOrder, tenantId, createdAt, updatedAt, internal squad detail.
// ---------------------------------------------------------------------------

export type PublicTeamListItem = {
  id: string;
  name: string;
  slug: string;
  /** TeamCategory enum value */
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  /** displayName from active TeamSeason, or team.name as fallback */
  displayName: string;
  shortName: string | null;
  season: { key: string; name: string } | null;
};

export type TeamsData = {
  teams: PublicTeamListItem[];
};

// ---------------------------------------------------------------------------
// Public weekplan — website-safe shape
//
// Grouped by calendar day. Events use the same PublicWebsiteEventItem shape.
// Intentionally omits: pitch/dressing-room allocation codes, board grid keys.
// ---------------------------------------------------------------------------

export type PublicWochenplanDay = {
  date: string;
  calendarWeek: number;
  weekdayLabel: string;
  events: PublicWebsiteEventItem[];
};

export type PublicWochenplanPublication = {
  weekId: string;
  variantLabel: string;
  /** Human-readable badge, e.g. "KW 26 | Standard-Wochenplan aktiv" */
  variantBadge: string;
  isPublished: boolean;
  publishedAt: Date | null;
};

export type WeekplanData = {
  publication: PublicWochenplanPublication | null;
  days: PublicWochenplanDay[];
};
