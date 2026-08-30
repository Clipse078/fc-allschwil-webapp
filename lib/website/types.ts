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
  tournaments: PublicWebsiteTournamentItem[];
};

/**
 * TOURNAMENT-LOGOS-01A — additive tournament identity fields for the public
 * website. Existing PublicWebsiteEventItem fields are preserved unchanged.
 */
export type PublicWebsiteTournamentOrganizer = {
  displayName: string;
  logoUrl: string | null;
  externalClubId: string | null;
};

export type PublicWebsiteTournamentParticipant = {
  id: string;
  displayName: string;
  logoUrl: string | null;
  kind: string;
  teamId: string | null;
  externalClubId: string | null;
};

export type PublicWebsiteTournamentItem = PublicWebsiteEventItem & {
  organizer: PublicWebsiteTournamentOrganizer | null;
  participants: PublicWebsiteTournamentParticipant[];
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

/**
 * Canonical OrgUnit grouping for a team in the active season.
 *
 * Sourced from the TeamSeason → TeamSeasonOrgUnit → OrgUnit graph (TEAM-CORE-02).
 * `isPrimary` is true when this is the designated primary grouping for the team.
 * `sortOrder` reflects the OrgUnit's canonical ordering within the tenant.
 *
 * The deprecated `category` enum is kept for backward-compatibility; new consumers
 * should group/filter by `orgUnit.name` / `orgUnit.key` instead.
 */
export type PublicTeamOrgUnit = {
  /** Stable OrgUnit identifier (CUID). */
  id: string;
  /** Display name, e.g. "Aktive", "Junioren", "Frauen". */
  name: string;
  /** Tenant-scoped URL-safe key, e.g. "aktive", "junioren". */
  key: string;
  /** Canonical sort position within the tenant — use for ordering groups. */
  sortOrder: number;
  /** True when this is the primary OrgUnit for this team in the active season. */
  isPrimary: boolean;
};

export type PublicTeamListItem = {
  id: string;
  name: string;
  slug: string;
  /**
   * @deprecated Legacy TeamCategory enum (AKTIVE | JUNIOREN | FRAUEN | …).
   * Retained for backward compatibility. New consumers must use `orgUnit` for grouping.
   */
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  /** displayName from active TeamSeason, or team.name as fallback */
  displayName: string;
  shortName: string | null;
  season: { key: string; name: string } | null;
  /**
   * Primary OrgUnit assignment for this team in the active season.
   *
   * Sourced from TeamSeason → TeamSeasonOrgUnit (where isPrimary = true) → OrgUnit.
   * Null when the team has no TeamSeasonOrgUnit assignment for the active season,
   * or when no primary OrgUnit is set (all assignments have isPrimary = false).
   *
   * The FCA website must use this field for team grouping/filtering.
   * Do NOT infer grouping from `category` or team name patterns.
   */
  orgUnit: PublicTeamOrgUnit | null;
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
// Public team detail — upcoming match ("Nächste Spiele")
//
// Mapped from canonical team-season match rows. Intentionally omits provider
// metadata, reconciliation fields, and internal visibility flags.
// ---------------------------------------------------------------------------

export type PublicTeamMatchSide = {
  /** Canonical tenant Team id when resolved; null for external-only sides. */
  teamId: string | null;
  name: string;
  shortName: string | null;
  clubName: string | null;
  logoUrl: string | null;
};

export type PublicTeamMatchOpponent = {
  name: string;
  shortName: string | null;
  clubName: string | null;
  logoUrl: string | null;
};

export type PublicTeamMatchVenue = {
  name: string | null;
  /** Canonical free-form location/address when available. */
  address: string | null;
};

export type PublicTeamMatchCompetition = {
  name: string | null;
};

export type PublicTeamMatchScore = {
  home: number | null;
  away: number | null;
};

export type PublicTeamMatchResultPerspective =
  | "WON"
  | "DRAW"
  | "LOST"
  | "UNKNOWN";

export type PublicTeamMatch = {
  id: string;
  startAt: Date;
  status: string;
  home: PublicTeamMatchSide;
  away: PublicTeamMatchSide;
  isHomeTeam: boolean;
  isAwayTeam: boolean;
  opponent: PublicTeamMatchOpponent;
  /**
   * Canonical persisted score from MatchExternalMapping.scoreHome/scoreAway.
   * Null for upcoming fixtures (nextMatches).
   */
  score: PublicTeamMatchScore | null;
  /**
   * Win/draw/loss from the current team's perspective.
   * Null for upcoming fixtures (nextMatches).
   */
  resultPerspective: PublicTeamMatchResultPerspective | null;
  venue: PublicTeamMatchVenue;
  competition: PublicTeamMatchCompetition;
};

// ---------------------------------------------------------------------------
// Public team detail — standings ("Rangliste")
//
// Provider-neutral league table for the current team season. Intentionally
// omits provider identifiers and raw upstream fields.
// ---------------------------------------------------------------------------

export type PublicTeamStandingsCompetition = {
  name: string;
  divisionName: string | null;
  groupName: string | null;
};

export type PublicTeamStandingRow = {
  position: number;
  team: {
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    isCurrentTeam: boolean;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  penaltyPoints: number | null;
};

export type PublicTeamStandings = {
  competition: PublicTeamStandingsCompetition;
  rows: PublicTeamStandingRow[];
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
  /**
   * Next website-visible MATCH fixtures for the current team season.
   * Includes home and away fixtures, ordered by startAt ascending (max 5).
   */
  nextMatches: PublicTeamMatch[];
  /**
   * Recent completed website-visible MATCH results for the current team season.
   * Includes home and away fixtures, ordered by startAt descending (max 5).
   */
  results: PublicTeamMatch[];
  /**
   * Current-season league standings for the mapped team.
   * Null when no SFV mapping exists, SFV is disabled, or provider data is unavailable.
   */
  standings: PublicTeamStandings | null;
};

export type TeamDetailData = {
  team: PublicTeamDetail;
};

// ---------------------------------------------------------------------------
// Public weekplan — website-safe shape
//
// Grouped by calendar day. Events use PublicWochenplanEventItem (extends the
// legacy PublicWebsiteEventItem for backward compatibility).
// Intentionally omits: internal allocation codes, board grid keys.
// ---------------------------------------------------------------------------

/** Canonical club/team identity for public Wochenplan match/tournament cards. */
export type PublicWochenplanClubIdentity = {
  displayName: string;
  logoUrl: string | null;
  teamId: string | null;
  externalClubId: string | null;
};

export type PublicWochenplanMatchIdentity = {
  home: PublicWochenplanClubIdentity;
  away: PublicWochenplanClubIdentity;
};

export type PublicWochenplanPitch = {
  name: string;
  facilityName: string | null;
};

/** Canonical dressing-room role — aligned with Infoboard DressingRoomAssignmentRole where applicable. */
export type PublicWochenplanDressingRoomRole =
  | "HOME"
  | "AWAY"
  | "TRAINING"
  | "TOURNAMENT_PARTICIPANT";

/**
 * Structured canonical Garderobe allocation for public Wochenplan consumers.
 * Internal facility-resource codes are intentionally omitted (same invariant as pitch).
 */
export type PublicWochenplanDressingRoom = {
  name: string;
  facilityName: string | null;
  role: PublicWochenplanDressingRoomRole;
  /** Participant/team label when role is TOURNAMENT_PARTICIPANT; null otherwise. */
  participantLabel?: string | null;
};

/**
 * Discriminated public Wochenplan event — TRAINING | MATCH | TOURNAMENT.
 * Extends PublicWebsiteEventItem so legacy consumers (WeekplanTeaserRenderer)
 * can still read id/title/startAt/location/team without migration.
 */
export type PublicWochenplanEventItem = PublicWebsiteEventItem & {
  /** Discriminator aligned with WeekplannerItemType. */
  kind: "TRAINING" | "MATCH" | "TOURNAMENT";
  matchIdentity?: PublicWochenplanMatchIdentity;
  organizer?: PublicWebsiteTournamentOrganizer | null;
  participants?: PublicWebsiteTournamentParticipant[];
  pitch?: PublicWochenplanPitch | null;
  /** Canonical Garderobe allocations; null when none exist. */
  dressingRooms?: PublicWochenplanDressingRoom[] | null;
};

export type PublicWochenplanDay = {
  date: string;
  calendarWeek: number;
  weekdayLabel: string;
  events: PublicWochenplanEventItem[];
};

export type PublicWochenplanActivePlan = {
  id: string;
  name: string;
};

export type PublicWochenplanCurrentWeek = {
  weekId: string;
  rangeLabel: string;
  calendarWeekLabel: string;
  calendarWeek: number;
  timeZone: string;
};

export type PublicWochenplanSummary = {
  trainingCount: number;
  matchCount: number;
  tournamentCount: number;
  /** Display label when a team filter is active, e.g. "Junioren F2". */
  teamLabel: string | null;
};

export type PublicWochenplanPublication = {
  weekId: string;
  variantLabel: string;
  /** Human-readable badge, e.g. "KW 26 | Standard-Wochenplan aktiv" */
  variantBadge: string;
  isPublished: boolean;
  publishedAt: Date | null;
  /** WOCHENPLAN-2.0-01B — active tenant plan id (for future preview flows). */
  activePlanId?: string | null;
  activePlanName?: string | null;
};

export type WeekplanData = {
  publication: PublicWochenplanPublication | null;
  /** Always present in current-week mode — the tenant-defined active/public plan. */
  activePlan: PublicWochenplanActivePlan;
  currentWeek: PublicWochenplanCurrentWeek;
  summary: PublicWochenplanSummary;
  days: PublicWochenplanDay[];
};

/** Legacy season-scope response — publication/summary/currentWeek omitted. */
export type WeekplanSeasonData = {
  publication: null;
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
