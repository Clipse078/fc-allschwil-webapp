/**
 * lib/publishing/infoboard/screen1-event-mapper.ts
 *
 * Pure, synchronous source-event type and mapper for Infoboard Screen 1.
 *
 * Maps a single eligible Screen 1 source event (plus its pre-computed temporal
 * bucket) to an InfoboardScreen1Event DTO.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no time access, no logging.
 *   - No placeholders ("-", "Unknown", "TBD", etc.) are generated.
 *   - Inputs are never mutated.
 *   - No publication eligibility is recalculated here.
 *   - No temporal bucket is recalculated here.
 *   - Allocation assignments are not inferred from homeAway or event type.
 *
 * Effective end time behavior (Section 10 choice B / C):
 *   The DTO field `endAt` is documented as "null when no explicit end time is
 *   stored." This mapper preserves the explicit source endAt. Temporal grouping
 *   in the feed builder uses getEffectiveEndAt() internally; the DTO intentionally
 *   exposes only the explicit value so consumers can distinguish "no end set."
 */

import type {
  InfoboardScreen1Event,
  InfoboardAllocationDisplay,
  PublishingEventType,
  PublishingEventStatus,
  TemporalBucket,
} from "../event-types";
import type { PublicationPolicyEvent } from "../policy/publication-policy";
import {
  resolveOpponentDisplayName,
  resolveCompetitionDisplay,
} from "../presentation/display-name-resolver";
import {
  resolveInfoboardTeamDisplayName,
  type InfoboardTeamDisplayNameContext,
} from "../presentation/infoboard-team-display-name";
import {
  resolvePitchDisplay,
  resolveDressingRoomDisplay,
  resolveAllocationList,
  type AllocationResourceInput,
} from "../presentation/allocation-display-resolver";
import {
  resolveInfoboardMatchPresentation,
  type InfoboardMatchIdentity,
} from "../presentation/infoboard-match-presentation";

// ── Screen 1 source event ──────────────────────────────────────────────────────

/**
 * Structural source type for a Screen 1 event.
 *
 * Satisfies PublicationPolicyEvent (tenantId, type, status, infoboardVisible,
 * websiteVisible, trainingsplanVisible, homeAway) and TemporalEvent (startAt,
 * endAt, type) via structural subtyping.
 *
 * Fields are narrowed from string → literal union where practical so the
 * mapper can assign to the DTO without a cast.
 *
 * All naming and allocation candidates are optional — the mapper returns null
 * for absent values rather than synthesising placeholders.
 */
export type Screen1SourceEvent = {
  // ── PublicationPolicyEvent fields (narrowed) ──────────────────────────────
  readonly tenantId: string | null;
  /** Narrowed to the verified infoboard event type union. */
  readonly type: PublishingEventType;
  /** Narrowed to the verified event status union. */
  readonly status: PublishingEventStatus;
  readonly infoboardVisible: boolean;
  readonly websiteVisible: boolean;
  readonly trainingsplanVisible: boolean;
  readonly homeAway: string | null;

  // ── TemporalEvent fields (shared with TemporalEvent shape) ────────────────
  readonly startAt: Date;
  readonly endAt: Date | null;

  // ── Identity ──────────────────────────────────────────────────────────────
  readonly id: string;

  // ── Display title ─────────────────────────────────────────────────────────
  /** Maps to InfoboardScreen1Event.displayTitle (required). */
  readonly title: string;

  // ── Season ────────────────────────────────────────────────────────────────
  /** Maps to InfoboardScreen1Event.seasonKey (required). */
  readonly seasonKey: string;

  // ── Team naming candidates ────────────────────────────────────────────────
  readonly team?: {
    /** Team.name — primary team identifier. */
    readonly name?: string | null;
    /** TeamSeason.displayName — season-scoped full name. */
    readonly displayName?: string | null;
    /** TeamSeason.shortName — season-scoped abbreviated name. */
    readonly shortName?: string | null;
    /** Team.alternativeName — canonical alternative name (INFOBOARD-LOGO-02). */
    readonly alternativeName?: string | null;
    /** Team.infoboardDisplayName — Infoboard Screen 1 override (INFOBOARD-TEAMNAME-01). */
    readonly infoboardDisplayName?: string | null;
    /** Team.infoboardTrainingDisplayName — Training card override (INFOBOARD-TEAMNAME-04A). */
    readonly infoboardTrainingDisplayName?: string | null;
    /** Team.infoboardMatchDisplayName — Match card override (INFOBOARD-TEAMNAME-04A). */
    readonly infoboardMatchDisplayName?: string | null;
    /** Team.infoboardTournamentDisplayName — Tournament card override (INFOBOARD-TEAMNAME-04A). */
    readonly infoboardTournamentDisplayName?: string | null;
  } | null;

  /** Explicit source-level team name fallback (e.g. from event import). */
  readonly teamFallbackName?: string | null;

  // ── Opponent naming candidates ────────────────────────────────────────────
  readonly opponent?: {
    /** Opponent.officialName */
    readonly officialName?: string | null;
    /** Opponent.shortName */
    readonly shortName?: string | null;
    /** Opponent.websiteName */
    readonly websiteName?: string | null;
    /** Opponent.infoboardName */
    readonly infoboardName?: string | null;
  } | null;

  /** Explicit source-level opponent name fallback (e.g. Event.opponentName). */
  readonly opponentFallbackName?: string | null;

  /**
   * Canonical opponent crest URL resolved from ExternalTeam.logoUrl →
   * ExternalClub.logoUrl. Populated by the canonical source loader when a
   * MatchExternalMapping with an awayExternalTeam exists. Null otherwise.
   */
  readonly opponentLogoUrl?: string | null;

  /**
   * Canonical home/away club + team identity for MATCH presentation
   * (INFOBOARD-LOGO-02). Populated by the canonical source loader when
   * Event.team and MatchExternalMapping data are available.
   */
  readonly matchIdentity?: InfoboardMatchIdentity | null;

  // ── Organizer ─────────────────────────────────────────────────────────────
  /** Event.organizerName — passed through directly to organizerDisplayName. */
  readonly organizerName?: string | null;

  // ── Competition ───────────────────────────────────────────────────────────
  /** Event.competitionLabel */
  readonly competitionLabel?: string | null;
  /** Explicit caller-provided fallback when competitionLabel is absent. */
  readonly competitionFallbackLabel?: string | null;

  // ── Timing extras ─────────────────────────────────────────────────────────
  readonly meetingTime?: Date | null;
  readonly resultLabel?: string | null;
  readonly intermediateResultLabel?: string | null;

  // ── Pitch allocation ──────────────────────────────────────────────────────
  /**
   * Pre-resolved pitch candidates, in resolution priority order:
   *   label (from static registry) → code (FacilityResource.code) → name (FacilityResource.name) → facilityName (Facility.name)
   */
  readonly pitch?: {
    readonly label?: string | null;
    readonly code?: string | null;
    readonly name?: string | null;
    readonly facilityName?: string | null;
  } | null;

  /**
   * Full ordered list of pitch/hall FacilityResource codes this activity
   * occupies (INFOBOARD-INTEGRATION-01C). Populated by the canonical
   * source loader from the complete Weekplanner pitchAllocations array —
   * never truncated to a single resource — so a training split across two
   * simultaneous half-pitch allocations is represented on both pitch cards
   * rather than collapsed onto one. Screen 1 does not read this field (it
   * continues to use the singular `pitch` candidate above for its one-line
   * destination display). When absent or empty, Screen 2 falls back to
   * `pitch.code` as a single-element list.
   */
  readonly pitchCodes?: readonly string[];

  // ── Dressing-room allocations ─────────────────────────────────────────────
  /**
   * Home / team dressing-room candidates.
   * Resolution priority: label → code → name.
   */
  readonly homeDressingRoom?: {
    readonly label?: string | null;
    readonly code?: string | null;
    readonly name?: string | null;
  } | null;

  /**
   * Full ordered list of home-side dressing-room candidates for TRAINING
   * (INFOBOARD-TRAINING-MULTI-ROOM-01). Populated by the canonical source
   * loader from every effective Weekplanner dressingRoomAllocation — never
   * truncated to the first room. Screen 1 training cards join these into one
   * KABINE label via resolveAllocationList(). MATCH continues to use the
   * singular `homeDressingRoom` slot above.
   */
  readonly homeDressingRooms?: readonly AllocationResourceInput[];

  /**
   * Full ordered list of home-side dressing-room FacilityResource codes
   * (INFOBOARD-INTEGRATION-01C). Same fallback contract as `pitchCodes`.
   */
  readonly homeDressingRoomCodes?: readonly string[];

  /**
   * Away / opponent dressing-room candidates.
   * Resolution priority: label → code → name.
   */
  readonly awayDressingRoom?: {
    readonly label?: string | null;
    readonly code?: string | null;
    readonly name?: string | null;
  } | null;

  /**
   * Full ordered list of away-side dressing-room FacilityResource codes
   * (MATCH only; INFOBOARD-INTEGRATION-01C). Same fallback contract as
   * `pitchCodes`.
   */
  readonly awayDressingRoomCodes?: readonly string[];

  /**
   * Referee dressing-room candidates.
   * Resolution priority: label → code → name.
   */
  readonly refereeDressingRoom?: {
    readonly label?: string | null;
    readonly code?: string | null;
    readonly name?: string | null;
  } | null;
};

// ── Mapper input ──────────────────────────────────────────────────────────────

export type MapScreen1EventInput = {
  readonly event: Screen1SourceEvent;
  readonly temporalBucket: TemporalBucket;
  /** Tenant club name for own-team club line resolution. */
  readonly tenantClubName?: string;
  /** Tenant club logo used for own-team crest resolution (Tenant.logoUrl). */
  readonly tenantLogoUrl?: string | null;
};

// ── mapScreen1Event ───────────────────────────────────────────────────────────

function resolveTrainingHomeDressingRoomLabel(
  event: Screen1SourceEvent,
): string | null {
  if (event.homeDressingRooms && event.homeDressingRooms.length > 0) {
    return resolveAllocationList(event.homeDressingRooms);
  }

  return resolveDressingRoomDisplay({
    label: event.homeDressingRoom?.label,
    code: event.homeDressingRoom?.code,
    name: event.homeDressingRoom?.name,
  });
}

function infoboardContextForEventType(
  type: PublishingEventType,
): InfoboardTeamDisplayNameContext | undefined {
  switch (type) {
    case "TRAINING":
      return "TRAINING";
    case "MATCH":
      return "MATCH";
    case "TOURNAMENT":
      return "TOURNAMENT";
    default:
      return undefined;
  }
}

/**
 * Maps a single Screen 1 source event to an InfoboardScreen1Event DTO.
 *
 * Pure function — deterministic, no side effects, no time access.
 * The input event and all nested objects are not mutated.
 */
export function mapScreen1Event(
  input: MapScreen1EventInput,
): InfoboardScreen1Event {
  const { event, temporalBucket, tenantClubName, tenantLogoUrl } = input;

  // ── Team display name ───────────────────────────────────────────────────
  const teamDisplayName = resolveInfoboardTeamDisplayName(
    {
      infoboardTrainingDisplayName: event.team?.infoboardTrainingDisplayName,
      infoboardMatchDisplayName: event.team?.infoboardMatchDisplayName,
      infoboardTournamentDisplayName: event.team?.infoboardTournamentDisplayName,
      infoboardDisplayName: event.team?.infoboardDisplayName,
      alternativeName: event.team?.alternativeName,
      shortName: event.team?.shortName,
      name: event.team?.name,
      fallbackName: event.teamFallbackName,
    },
    infoboardContextForEventType(event.type),
  );

  // ── Opponent display name ───────────────────────────────────────────────
  const opponentDisplayName = resolveOpponentDisplayName(
    {
      infoboardName: event.opponent?.infoboardName,
      shortName: event.opponent?.shortName,
      officialName: event.opponent?.officialName,
      websiteName: event.opponent?.websiteName,
      fallbackName: event.opponentFallbackName,
    },
    "INFOBOARD",
  );

  // ── Competition label ───────────────────────────────────────────────────
  const competitionLabel = resolveCompetitionDisplay({
    competitionLabel: event.competitionLabel,
    fallbackLabel: event.competitionFallbackLabel,
  });

  // ── Pitch label ─────────────────────────────────────────────────────────
  const pitchLabel = resolvePitchDisplay({
    label: event.pitch?.label,
    code: event.pitch?.code,
    name: event.pitch?.name,
    facilityName: event.pitch?.facilityName,
  });

  // ── Dressing-room labels ────────────────────────────────────────────────
  const homeDressingRoomLabel =
    event.type === "TRAINING"
      ? resolveTrainingHomeDressingRoomLabel(event)
      : resolveDressingRoomDisplay({
          label: event.homeDressingRoom?.label,
          code: event.homeDressingRoom?.code,
          name: event.homeDressingRoom?.name,
        });

  const awayDressingRoomLabel = resolveDressingRoomDisplay({
    label: event.awayDressingRoom?.label,
    code: event.awayDressingRoom?.code,
    name: event.awayDressingRoom?.name,
  });

  const refereeDressingRoomLabel = resolveDressingRoomDisplay({
    label: event.refereeDressingRoom?.label,
    code: event.refereeDressingRoom?.code,
    name: event.refereeDressingRoom?.name,
  });

  const allocation: InfoboardAllocationDisplay = {
    pitchLabel,
    homeDressingRoomLabel,
    awayDressingRoomLabel,
    refereeDressingRoomLabel,
  };

  // ── Date/time conversions ───────────────────────────────────────────────
  // endAt: preserve explicit value; null means "no explicit end stored."
  // Temporal grouping uses getEffectiveEndAt() internally for classification.
  const endAt = event.endAt !== null ? event.endAt.toISOString() : null;
  const meetingTime =
    event.meetingTime != null ? event.meetingTime.toISOString() : null;

  const matchPresentation =
    event.type === "MATCH"
      ? resolveInfoboardMatchPresentation(
          event.matchIdentity,
          tenantLogoUrl,
          tenantClubName,
        )
      : null;

  return {
    id: event.id,
    type: event.type,
    displayTitle: event.title,
    teamDisplayName,
    opponentDisplayName,
    opponentLogoUrl: event.opponentLogoUrl ?? null,
    matchPresentation,
    organizerDisplayName: event.organizerName ?? null,
    competitionLabel,
    startAt: event.startAt.toISOString(),
    endAt,
    meetingTime,
    status: event.status,
    resultLabel: event.resultLabel ?? null,
    intermediateResultLabel: event.intermediateResultLabel ?? null,
    temporalBucket,
    allocation,
    seasonKey: event.seasonKey,
  };
}
