/**
 * Shared types for the /api/public/v1/website/* feed endpoints.
 *
 * Design invariants:
 * - WebsiteResponseEnvelope<T> is the single envelope wrapper for all website API responses.
 * - Article types are split: list items never expose content/body (bandwidth + security).
 * - Only safe, website-facing fields are declared here; internal DB fields stay in lib/news/.
 * - Workflow/review fields (status, reviewNotes, etc.) are never exposed publicly.
 */

import type { RichTextValue } from "@/lib/cms/rich-text";

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
 *
 * Rendering priority for consumers:
 *   1. contentJson (structured TipTap/ProseMirror JSON) — render via rich text renderer
 *   2. content     (legacy Markdown / plain-text string) — render as Markdown
 *   3. empty
 */
export type PublicNewsArticleDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Legacy Markdown / plain-text content. Populated for all articles. */
  content: string;
  /**
   * Structured TipTap/ProseMirror JSON content (CMS V4.2+).
   * Present only for articles edited through the rich text editor.
   * When present, consumers should prefer this over `content`.
   */
  contentJson: RichTextValue | null;
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
  /** Null when the event's Season was deleted (ADMIN-DELETE-SEASON-01-C1). */
  season: {
    key: string;
    name: string;
  } | null;
};

export type EventsData = {
  events: PublicWebsiteEventItem[];
};

export type MatchesData = {
  matches: PublicWebsiteEventItem[];
};

export type ClubEventsData = {
  clubEvents: PublicWebsiteEventItem[];
};

export type TournamentsData = {
  tournaments: PublicWebsiteEventItem[];
};

export type TrainingsData = {
  trainings: PublicWebsiteEventItem[];
};

// ---------------------------------------------------------------------------
// Public team — website-safe shapes
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
// Public team detail — squad member (player)
//
// Privacy: NEVER expose personId, dateOfBirth, email, phone, address, remarks,
// player ratings, medical information, or any internal admin fields.
// photo is reserved for future schema addition (always null today).
// ---------------------------------------------------------------------------

export type PublicSquadMember = {
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  positionLabel: string | null;
  captain: boolean;
  viceCaptain: boolean;
  /** Reserved: no photo field in current schema. Always null. */
  photo: string | null;
};

// ---------------------------------------------------------------------------
// Public team detail — trainer staff member
//
// Privacy: NEVER expose personId, email, phone, internal notes, or remarks.
// photo is reserved for future schema addition (always null today).
// ---------------------------------------------------------------------------

export type PublicTrainerMember = {
  firstName: string;
  lastName: string;
  roleLabel: string | null;
  /** Reserved: no photo field in current schema. Always null. */
  photo: string | null;
};

// ---------------------------------------------------------------------------
// Public team detail — training session
//
// pitchName is resolved from FacilityResource (tenantId + pitchCode → name).
// pitchCode (internal allocation code) is NEVER exposed.
// ---------------------------------------------------------------------------

export type PublicTeamTrainingSession = {
  /** Day of week in German (e.g. "Dienstag"), derived from startTime. */
  weekday: string;
  /** ISO 8601 UTC start timestamp. */
  startTime: string;
  /** ISO 8601 UTC end timestamp, null when not set. */
  endTime: string | null;
  location: string | null;
  /** Human-readable pitch name from facility registry, null when unresolvable. */
  pitchName: string | null;
};

// ---------------------------------------------------------------------------
// Public team detail — full team shape
//
// Privacy: description and heroImage are reserved for a future schema addition.
// All currently null. Squad/trainer visibility is gated by TeamSeason flags.
// ---------------------------------------------------------------------------

export type PublicTeamDetail = {
  name: string;
  displayName: string;
  slug: string;
  /** TeamCategory enum value */
  category: string;
  ageGroup: string | null;
  genderGroup: string | null;
  shortName: string | null;
  /** Active or requested season info; null when no matching TeamSeason exists. */
  season: { key: string; name: string } | null;
  /**
   * Reserved for future schema addition. Always null today.
   * Will carry Markdown description when Team.description field is added.
   */
  description: null;
  /**
   * Reserved for future schema addition. Always null today.
   * Will carry hero image URL when Team.heroMediaId FK is added.
   */
  heroImage: null;
  /**
   * Website-visible squad players for the requested season.
   * Empty when TeamSeason.squadWebsiteVisible = false.
   */
  squad: PublicSquadMember[];
  /**
   * Website-visible trainer staff for the requested season.
   * Empty when TeamSeason.trainerTeamWebsiteVisible = false.
   */
  trainers: PublicTrainerMember[];
  /**
   * Upcoming TRAINING events for the team (next 4 weeks, website-visible).
   * Ordered by startTime ascending.
   */
  training: PublicTeamTrainingSession[];
};

export type TeamDetailData = {
  team: PublicTeamDetail;
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

// ---------------------------------------------------------------------------
// Public homepage — website-safe section shape
//
// Intentionally omits: tenantId, createdAt, updatedAt, isEnabled (only
// enabled sections are returned), and any internal admin flags.
//
// config carries type-specific display parameters (e.g. itemCount, heading).
// Consumers should treat unknown keys inside config as ignorable extras.
// ---------------------------------------------------------------------------

export type PublicHomepageSectionItem = {
  id: string;
  /** Section type key, e.g. "hero", "newsTeaser". See section-types registry. */
  type: string;
  /** Admin-configured human-readable label. */
  label: string;
  /** Display order (ascending, 0-based). */
  sortOrder: number;
  /** Type-specific display configuration. */
  config: Record<string, unknown>;
};

export type HomepageData = {
  sections: PublicHomepageSectionItem[];
};
