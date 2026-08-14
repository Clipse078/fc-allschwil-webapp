/**
 * components/infoboard/screen1/InfoboardScreen1.tsx
 *
 * Infoboard Screen 1 — full-screen TV event schedule board.
 *
 * Design (INFOBOARD-04B — premium dark card-based redesign):
 *   - Full dark stadium palette; dark navy header and footer.
 *   - Each event is a full-width card with three zones:
 *       LEFT ZONE   — status label (JETZT / ALS NÄCHSTES) + start time
 *       CENTER ZONE — event type, dominant team/tournament name, opponent
 *                     (logos placed beside club name for matches only)
 *       RIGHT ZONE  — destination: pitch value + dressing-room assignments
 *   - No countdown text; only JETZT / ALS NÄCHSTES.
 *   - No column dividers; card-based visual separation.
 *   - Club branding large in dark header, left side.
 *   - Clock and date in header center-right zone.
 *   - Alexa-safe zone in header far right — intentionally empty.
 *   - SportClubEvo branding in footer, not in header.
 *
 * Invariants:
 *   - Pure presentational server component — no "use client", no effects,
 *     no timers, no fetch, no browser storage, no URL parameter logic.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone is always taken explicitly from feed.tenant.timezone.
 *   - No new Date() without an argument; no server-local or browser-local TZ.
 *   - null / undefined values are never rendered as strings.
 *   - No placeholder dashes, "Unknown", "TBD", "N/A", or empty badges.
 *   - Inputs are never mutated.
 *   - Reusable: FC Allschwil content lives only in the preview fixture.
 *   - No referee dressing-room display (Screen 1 wayfinding contract).
 *   - currentTimeIso is always supplied explicitly; never implicitly derived.
 *   - No countdown text (IN X MIN.); temporal labels are JETZT or ALS NÄCHSTES.
 */

import type { ReactElement } from "react";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardTeamAllocationPresentation,
  InfoboardEventPresentationExtension,
} from "./screen1-presentation-types";
import {
  DEFAULT_INFOBOARD_DISPLAY_THEME,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { LiveClockScreen1 } from "./LiveClockScreen1";
import styles from "./InfoboardScreen1.module.css";

// ── Public types ──────────────────────────────────────────────────────────────

export type InfoboardScreen1Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen1Props = {
  feed: InfoboardScreen1Feed;
  branding?: InfoboardScreen1Branding;
  /** Tenant-configurable announcement bar. Not persisted. */
  announcement?: InfoboardAnnouncementPresentation;
  /**
   * Optional presentation extensions for individual events.
   * Used to supply multi-team allocation data until a canonical feed contract
   * is added in a future Publishing Platform slice.
   */
  eventPresentation?: readonly InfoboardEventPresentationExtension[];
  /**
   * Current moment as a UTC ISO-8601 string, supplied by the caller.
   * When absent, no clock is displayed and the date falls back to
   * feed.displayDate. Never call new Date() without an argument.
   */
  currentTimeIso?: string | null;
  /**
   * Display theme (INFOBOARD-INTEGRATION-01B). Defaults to "DARK" — the
   * existing premium stadium theme — when omitted, so every existing caller
   * (previews, tests) is unaffected. Presentation only: never changes feed
   * content, layout, or content hierarchy — only CSS custom-property values
   * via the rendered `data-theme` attribute.
   */
  theme?: InfoboardDisplayTheme;
  /**
   * Per-board header configuration (INFOBOARD-V2).
   * Controls subtitle, time, date, weather visibility and subtitle text.
   */
  headerConfig?: {
    readonly subtitleEnabled?: boolean;
    readonly subtitleText?: string | null;
    readonly showTime?: boolean;
    readonly showDate?: boolean;
  };
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Prototype max events rendered before showing overflow warning. */
const PROTOTYPE_CAPACITY = 12;

// ── Event-type labels (presentation-only, German) ─────────────────────────────

const EVENT_TYPE_LABELS: Record<PublishingEventType, string> = {
  TRAINING: "TRAINING",
  MATCH: "SPIEL",
  TOURNAMENT: "TURNIER",
  OTHER: "EVENT",
  VACATION_PERIOD: "FERIENBLOCK",
};

// ── Temporal types ────────────────────────────────────────────────────────────

type TemporalBucket = "current" | "next" | "later";

type FlatEvent = {
  event: InfoboardScreen1Event;
  temporal: TemporalBucket;
};

/**
 * A displayable unit in the rendered card list.
 *
 *   "event"          — a single non-training event (or single training at a
 *                      unique start time), rendered with the standard EventCard.
 *   "training-group" — two or more TRAINING events sharing the same startAt,
 *                      collapsed into one aggregate TrainingGroupCard.
 */
type DisplayItem =
  | { kind: "event"; item: FlatEvent }
  | { kind: "training-group"; items: FlatEvent[]; temporal: TemporalBucket };

// ── Time / date formatting ────────────────────────────────────────────────────

function formatTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(isoString));
}

function formatDisplayDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Temporal status helpers ───────────────────────────────────────────────────

/**
 * Returns the inline status label for an event card.
 *   current → "JETZT"
 *   next    → "ALS NÄCHSTES"
 *   later   → null (no label)
 *
 * No countdown text is ever returned; only JETZT or ALS NÄCHSTES.
 */
function statusLabel(temporal: TemporalBucket): string | null {
  if (temporal === "current") return "JETZT";
  if (temporal === "next") return "ALS NÄCHSTES";
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findEventExtension(
  eventId: string,
  extensions: readonly InfoboardEventPresentationExtension[] | undefined,
): InfoboardEventPresentationExtension | null {
  if (extensions === undefined) return null;
  for (const ext of extensions) {
    if (ext.eventId === eventId) return ext;
  }
  return null;
}

function buildFlatList(feed: InfoboardScreen1Feed): FlatEvent[] {
  const result: FlatEvent[] = [];
  for (const event of feed.current) {
    result.push({ event, temporal: "current" });
  }
  for (const event of feed.next) {
    result.push({ event, temporal: "next" });
  }
  for (const event of feed.later) {
    result.push({ event, temporal: "later" });
  }
  return result;
}

/**
 * Groups TRAINING events that share an identical startAt ISO string into a
 * single training-group display item.
 *
 * ALL trainings — including solo ones — use the training-group card so the
 * visual language is consistent regardless of how many teams share a start
 * time. This satisfies the "one training and six simultaneous trainings
 * should feel like the same component" requirement.
 */
function buildDisplayList(flatList: FlatEvent[]): DisplayItem[] {
  // First pass: bucket ALL training events by startAt
  const trainingByStart = new Map<string, FlatEvent[]>();
  for (const item of flatList) {
    if (item.event.type === "TRAINING") {
      const key = item.event.startAt;
      let bucket = trainingByStart.get(key);
      if (bucket === undefined) {
        bucket = [];
        trainingByStart.set(key, bucket);
      }
      bucket.push(item);
    }
  }

  // Second pass: emit display items preserving original list order
  const emitted = new Set<string>();
  const result: DisplayItem[] = [];

  for (const item of flatList) {
    if (item.event.type === "TRAINING") {
      const key = item.event.startAt;
      if (emitted.has(key)) continue; // already emitted as part of a group
      emitted.add(key);

      const group = trainingByStart.get(key)!;
      // All training groups (including solo) use training-group card.
      result.push({ kind: "training-group", items: group, temporal: item.temporal });
    } else {
      result.push({ kind: "event", item });
    }
  }

  return result;
}

/**
 * Strips a club name prefix from a team display name for Infoboard rendering.
 *
 * Example: "FC ALLSCHWIL JUNIOREN D-9 D1" → "JUNIOREN D-9 D1"
 *
 * The club identity is already established in the header, so repeating it
 * on every training row is redundant. This is a presentation-only
 * transformation — canonical team names are never mutated.
 *
 * Matching is case-insensitive. Returns the original name when no match.
 */
function stripClubPrefix(teamName: string, clubName: string): string {
  if (!clubName) return teamName;
  const prefixLower = clubName.toUpperCase();
  const nameLower = teamName.toUpperCase();
  if (nameLower.startsWith(prefixLower)) {
    const stripped = teamName.slice(clubName.length).trimStart();
    return stripped.length > 0 ? stripped : teamName;
  }
  return teamName;
}

/** Accent color key for card left stripe and current-event tint. */
function stripeKey(temporal: TemporalBucket, type: PublishingEventType): string {
  if (temporal === "current") return "red";
  if (temporal === "next") return "blue";
  if (type === "MATCH") return "red";
  if (type === "TOURNAMENT") return "orange";
  return "blue";
}

// ── Tournament allocation block ───────────────────────────────────────────────

type ParticipantAllocationBlockProps = {
  allocations: readonly InfoboardTeamAllocationPresentation[];
};

/**
 * Compact allocation matrix for tournaments with ≥ 3 participating teams.
 * Each team is paired explicitly with its dressing room on the same row.
 */
function ParticipantAllocationBlock({
  allocations,
}: ParticipantAllocationBlockProps): ReactElement {
  return (
    <div
      className={styles.participantAllocationBlock}
      data-testid="participant-allocation-block"
    >
      {allocations.map((alloc) => (
        <div
          key={alloc.id}
          className={
            alloc.isHomeTeam === true
              ? `${styles.participantAllocationRow} ${styles.homeTeamEmphasis}`
              : styles.participantAllocationRow
          }
        >
          <span className={styles.participantRoomValue}>
            {alloc.dressingRoomLabel !== null ? alloc.dressingRoomLabel : "—"}
          </span>
          <span className={styles.participantTeamName}>
            {alloc.teamDisplayName}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Match destination block (RIGHT zone) ─────────────────────────────────────

type MatchDestinationProps = {
  event: InfoboardScreen1Event;
};

/**
 * Renders pitch + home/away dressing-room pairings in the destination zone.
 * No logos here — logos are in the event identity (CENTER) zone.
 */
function MatchDestination({ event }: MatchDestinationProps): ReactElement {
  const { homeDressingRoomLabel, awayDressingRoomLabel, pitchLabel } = event.allocation;
  const hasHome = homeDressingRoomLabel !== null && event.teamDisplayName !== null;
  const hasAway = awayDressingRoomLabel !== null && event.opponentDisplayName !== null;

  return (
    <div className={styles.destinationZone}>
      {/* Pitch */}
      <div className={styles.destPitchRow}>
        <span className={styles.destLabel}>PLATZ</span>
        {pitchLabel !== null ? (
          <span className={styles.destPitchValue} data-testid="pitch-value">
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      {/* Dressing rooms */}
      {(hasHome || hasAway) ? (
        <div
          className={styles.matchAllocation}
          data-testid="match-allocation"
        >
          <span className={styles.destLabel}>KABINE</span>
          {hasHome && (
            <div className={styles.matchAllocRow}>
              <span className={styles.matchAllocRoom}>{homeDressingRoomLabel}</span>
              <span className={styles.matchAllocTeam}>{event.teamDisplayName}</span>
            </div>
          )}
          {hasAway && (
            <div className={styles.matchAllocRow}>
              <span className={styles.matchAllocRoom}>{awayDressingRoomLabel}</span>
              <span className={styles.matchAllocTeam}>{event.opponentDisplayName}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={styles.matchAllocation}
          data-testid="match-allocation"
        >
          <span
            className={styles.dressingRoomMissing}
            data-testid="dressing-room-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        </div>
      )}
    </div>
  );
}

// ── Training destination block (RIGHT zone) ──────────────────────────────────

type TrainingDestinationProps = {
  event: InfoboardScreen1Event;
};

function TrainingDestination({ event }: TrainingDestinationProps): ReactElement {
  const { homeDressingRoomLabel, pitchLabel } = event.allocation;

  return (
    <div
      className={styles.destinationZone}
      data-testid="training-allocation"
    >
      {/* Pitch */}
      <div className={styles.destPitchRow}>
        <span className={styles.destLabel}>PLATZ</span>
        {pitchLabel !== null ? (
          <span className={styles.destPitchValue} data-testid="pitch-value">
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      {/* Dressing room */}
      <div className={styles.destRoomRow}>
        <span className={styles.destLabel}>KABINE</span>
        {homeDressingRoomLabel !== null ? (
          <span className={styles.destRoomValue}>
            {homeDressingRoomLabel}
          </span>
        ) : (
          <span
            className={styles.dressingRoomMissing}
            data-testid="dressing-room-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tournament destination block (RIGHT zone) ────────────────────────────────

type TournamentDestinationProps = {
  event: InfoboardScreen1Event;
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined;
};

function TournamentDestination({
  event,
  participantAllocations,
}: TournamentDestinationProps): ReactElement {
  const { pitchLabel } = event.allocation;

  return (
    <div className={styles.destinationZone}>
      {/* Pitch */}
      <div className={styles.destPitchRow}>
        <span className={styles.destLabel}>PLATZ</span>
        {pitchLabel !== null ? (
          <span className={styles.destPitchValue} data-testid="pitch-value">
            {pitchLabel}
          </span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      {/* Multi-team allocation */}
      {participantAllocations !== undefined && participantAllocations.length >= 3 && (
        <ParticipantAllocationBlock allocations={participantAllocations} />
      )}
    </div>
  );
}

// ── Training group card ───────────────────────────────────────────────────────

type TrainingGroupCardProps = {
  items: FlatEvent[];
  timeZone: string;
  cardCount: number;
  /** Club name for prefix stripping from team display names. */
  clubName: string;
};

/**
 * Aggregated card for two or more TRAINING events sharing the same start time.
 *
 * Layout:
 *   LEFT ZONE  — JETZT / ALS NÄCHSTES status label + start time + shared end
 *                time (shown once when all trainings end at the same time).
 *   BODY ZONE  — spans the event + destination columns; renders a column-header
 *                row followed by one compact row per team (TEAM | PLATZ | KABINE).
 *
 * Invariants (matching EventCard):
 *   - data-testid="event-row" is preserved so row counts remain testable.
 *   - Missing pitch/dressing-room → NICHT ZUGETEILT warning (amber).
 *   - No referee data rendered.
 *   - No club shirt colours from the mockup — no canonical data source.
 */
function TrainingGroupCard({
  items,
  timeZone,
  cardCount,
  clubName,
}: TrainingGroupCardProps): ReactElement {
  const first = items[0];
  const temporal = first.temporal;
  const startAt = first.event.startAt;
  const startTime = formatTime(startAt, timeZone);
  const label = statusLabel(temporal);
  const stripe = stripeKey(temporal, "TRAINING");

  // Shared end time: display once in the LEFT ZONE when all trainings share
  // the same endAt.  When end times differ, show per-row in the BODY ZONE.
  const firstEndAt = first.event.endAt;
  const allSameEnd = items.every((it) => it.event.endAt === firstEndAt);
  const commonEndTime =
    allSameEnd && firstEndAt !== null ? formatTime(firstEndAt, timeZone) : null;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-row"
      data-type="TRAINING"
      data-temporal={temporal}
      data-stripe={stripe}
      data-event-count={cardCount}
    >
      {/* ── LEFT ZONE: Status + Time ─────────────────────────────────── */}
      <div className={styles.cardTimeZone}>
        {label !== null && (
          <span
            className={styles.statusLabel}
            data-testid={`status-label-${temporal}`}
            data-status={temporal === "current" ? "current" : "next"}
          >
            {label}
          </span>
        )}
        <time className={styles.eventTime} dateTime={startAt}>
          {startTime}
        </time>
        {commonEndTime !== null && (
          <span className={styles.eventEndTime} aria-label="Bis">
            bis {commonEndTime}
          </span>
        )}
      </div>

      {/* ── BODY ZONE: group header + per-team rows ───────────────────── */}
      <div className={styles.trainingGroupBody} data-testid="training-group">
        {/* Column headers */}
        <div className={styles.trainingGroupColHeaders} aria-hidden="true">
          <span
            className={styles.trainingGroupTypeBadge}
            data-event-type="TRAINING"
          >
            TRAINING
          </span>
          <span className={styles.trainingGroupColLabel}>PLATZ</span>
          <span className={styles.trainingGroupColLabel}>KABINE</span>
        </div>

        {/* One row per team */}
        {items.map((it) => {
          const { pitchLabel, homeDressingRoomLabel } = it.event.allocation;
          const rowEndAt = it.event.endAt;
          const rowEndTime =
            !allSameEnd && rowEndAt !== null
              ? formatTime(rowEndAt, timeZone)
              : null;
          return (
            <div
              key={it.event.id}
              className={styles.trainingGroupTeamRow}
              data-testid="training-group-row"
            >
              {/* TEAM — club prefix stripped for readability */}
              <span className={styles.trainingGroupTeamName}>
                {stripClubPrefix(
                  it.event.teamDisplayName ?? it.event.displayTitle,
                  clubName,
                )}
                {rowEndTime !== null && (
                  <span className={styles.trainingGroupRowEndTime} aria-label="Bis">
                    {" "}bis {rowEndTime}
                  </span>
                )}
              </span>

              {/* PLATZ */}
              {pitchLabel !== null ? (
                <span
                  className={styles.trainingGroupPitchValue}
                  data-testid="pitch-value"
                >
                  {pitchLabel}
                </span>
              ) : (
                <span
                  className={styles.dressingRoomMissing}
                  data-testid="pitch-unassigned-warning"
                >
                  NICHT ZUGETEILT
                </span>
              )}

              {/* KABINE */}
              {homeDressingRoomLabel !== null ? (
                <span className={styles.trainingGroupRoomValue}>
                  {homeDressingRoomLabel}
                </span>
              ) : (
                <span
                  className={styles.dressingRoomMissing}
                  data-testid="dressing-room-unassigned-warning"
                >
                  NICHT ZUGETEILT
                </span>
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

type EventCardProps = {
  item: FlatEvent;
  timeZone: string;
  clubLogoSrc: string | null;
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined;
  eventCount: number;
};

function EventCard({
  item,
  timeZone,
  clubLogoSrc,
  participantAllocations,
  eventCount,
}: EventCardProps): ReactElement {
  const { event, temporal } = item;
  const startTime = formatTime(event.startAt, timeZone);
  const endTime = event.endAt !== null ? formatTime(event.endAt, timeZone) : null;
  const isMatch = event.type === "MATCH";
  const isTournament = event.type === "TOURNAMENT";

  const label = statusLabel(temporal);
  const stripe = stripeKey(temporal, event.type);

  const typeDisplayLabel = isMatch
    ? (event.competitionLabel ?? EVENT_TYPE_LABELS["MATCH"])
    : EVENT_TYPE_LABELS[event.type] ?? event.type;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-row"
      data-type={event.type}
      data-temporal={temporal}
      data-stripe={stripe}
      data-event-count={eventCount}
    >
      {/* ── LEFT ZONE: Status + Time ─────────────────────────────────── */}
      <div className={styles.cardTimeZone}>
        {label !== null && (
          <span
            className={styles.statusLabel}
            data-testid={`status-label-${temporal}`}
            data-status={temporal === "current" ? "current" : "next"}
          >
            {label}
          </span>
        )}
        <time className={styles.eventTime} dateTime={event.startAt}>
          {startTime}
        </time>
        {endTime !== null && (
          <span className={styles.eventEndTime} aria-label="Bis">
            bis {endTime}
          </span>
        )}
      </div>

      {/* ── CENTER ZONE: Event identity ──────────────────────────────── */}
      <div className={styles.cardEventZone}>
        <span
          className={styles.eventTypeLabel}
          data-event-type={event.type}
        >
          {typeDisplayLabel}
        </span>

        {isMatch ? (
          <div className={styles.matchIdentity}>
            {/* Home team with logo */}
            <div className={styles.matchTeamRow} data-testid="match-home-team-row">
              {clubLogoSrc !== null && (
                <img
                  src={clubLogoSrc}
                  alt=""
                  className={styles.teamLogo}
                  aria-hidden="true"
                  data-testid="home-team-logo"
                />
              )}
              <span className={styles.eventTeamMain}>
                {event.teamDisplayName}
              </span>
            </div>
            {/* VS separator */}
            <span className={styles.vsLabel} aria-hidden="true">vs.</span>
            {/* Away team (no logo available in current data model) */}
            {event.opponentDisplayName !== null && (
              <div className={styles.matchTeamRow} data-testid="match-away-team-row">
                <span className={styles.eventTeamOpponent}>
                  {event.opponentDisplayName}
                </span>
              </div>
            )}
          </div>
        ) : isTournament ? (
          <span className={styles.eventTeamMain}>{event.displayTitle}</span>
        ) : (
          <>
            {event.teamDisplayName !== null ? (
              <span className={styles.eventTeamMain}>{event.teamDisplayName}</span>
            ) : (
              event.displayTitle !== null && (
                <span className={styles.eventTeamMain}>{event.displayTitle}</span>
              )
            )}
            {event.organizerDisplayName !== null && (
              <span className={styles.eventTeamSubtitle}>
                {event.organizerDisplayName}
              </span>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT ZONE: Destination (Pitch + Dressing rooms) ─────────── */}
      {isMatch ? (
        <MatchDestination event={event} />
      ) : isTournament ? (
        <TournamentDestination
          event={event}
          participantAllocations={participantAllocations}
        />
      ) : (
        <TrainingDestination event={event} />
      )}
    </li>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

type FooterProps = {
  announcement: InfoboardAnnouncementPresentation | undefined;
  productLogoSrc: string | null;
};

/**
 * Dark navy footer.
 * Left: fixed announcement icon + ticker text (when announcement enabled and non-blank).
 * Right: "POWERED BY" + SportClubEvo product logo.
 *
 * The announcement text scrolls horizontally when it overflows (AnnouncementTicker).
 * Short messages that fit remain static. The icon stays fixed regardless.
 */
function Footer({ announcement, productLogoSrc }: FooterProps): ReactElement {
  const announcementEnabled =
    announcement !== undefined &&
    announcement.enabled === true &&
    typeof announcement.text === "string" &&
    announcement.text.trim().length > 0;

  const footerStyle: React.CSSProperties = {};
  if (announcementEnabled && announcement !== undefined) {
    if (announcement.backgroundColor && announcement.backgroundColor.trim().length > 0) {
      footerStyle.backgroundColor = announcement.backgroundColor;
    }
    if (announcement.textColor && announcement.textColor.trim().length > 0) {
      footerStyle.color = announcement.textColor;
    }
  }

  const hasInlineStyle = Object.keys(footerStyle).length > 0;

  return (
    <footer
      className={styles.footer}
      data-testid={announcementEnabled ? "announcement-bar" : "infoboard-footer"}
      style={hasInlineStyle ? footerStyle : undefined}
    >
      <div className={styles.footerLeft}>
        {announcementEnabled && announcement !== undefined && (
          <>
            {/* Fixed icon — never scrolls */}
            <span
              className={styles.footerAnnouncementIcon}
              data-testid="announcement-icon"
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </span>
            {/* Scrolling text — AnnouncementTicker detects overflow and animates */}
            <AnnouncementTicker text={announcement.text!} />
          </>
        )}
      </div>
      <div className={styles.footerRight} data-testid="product-branding">
        <span className={styles.footerPoweredBy}>POWERED BY</span>
        {productLogoSrc !== null ? (
          <img
            src={productLogoSrc}
            alt="SportClubEvo"
            className={styles.footerProductLogo}
            width={120}
            height={28}
          />
        ) : (
          <span className={styles.footerProductFallback}>SportClubEvo</span>
        )}
      </div>
    </footer>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen1({
  feed,
  branding,
  announcement,
  eventPresentation,
  currentTimeIso,
  theme = DEFAULT_INFOBOARD_DISPLAY_THEME,
  headerConfig,
}: InfoboardScreen1Props): ReactElement {
  const { tenant } = feed;
  const timeZone = tenant.timezone;
  const themeAttr = theme.toLowerCase();

  // Header visibility settings (per-board config or defaults)
  const showTime = headerConfig?.showTime !== false;
  const showDate = headerConfig?.showDate !== false;
  const subtitleEnabled = headerConfig?.subtitleEnabled !== false;
  const subtitleText =
    headerConfig?.subtitleText?.trim() ||
    "HEUTE AUF DER SPORTANLAGE";

  // Club name for prefix stripping (presentation-only)
  const clubNameUpper = tenant.name.toUpperCase();

  const flatList = buildFlatList(feed);
  const displayList = buildDisplayList(flatList);
  const totalCards = displayList.length;

  const overflowCount =
    totalCards > PROTOTYPE_CAPACITY ? totalCards - PROTOTYPE_CAPACITY : 0;
  const visibleDisplayList = overflowCount > 0
    ? displayList.slice(0, PROTOTYPE_CAPACITY)
    : displayList;

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  // Static date fallback used only when currentTimeIso is absent.
  const staticDateLine =
    currentTimeIso == null ? formatDisplayDate(feed.displayDate) : null;

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen1-root"
      data-theme={themeAttr}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header} data-testid="infoboard-header">

        {/* Left zone: club branding */}
        <div className={styles.headerLeft} data-testid="header-left">
          {clubLogoSrc !== null ? (
            <img
              src={clubLogoSrc}
              alt={`${tenant.name} Wappen`}
              className={styles.clubLogo}
              width={64}
              height={64}
            />
          ) : (
            <div className={styles.clubLogoFallback} aria-hidden="true">
              {tenant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className={styles.headerClubName}>{tenant.name}</span>
        </div>

        {/* Center zone: current time + date */}
        <div className={styles.headerCenter} data-testid="header-center">
          {currentTimeIso != null ? (
            <LiveClockScreen1
              initialTimeIso={currentTimeIso}
              timezone={timeZone}
              showTime={showTime}
              showDate={showDate}
            />
          ) : showDate ? (
            <span className={styles.headerDateFallback}>{staticDateLine}</span>
          ) : null}
        </div>

        {/* Right zone: Alexa-safe — intentionally empty */}
        <div
          className={styles.headerRight}
          data-testid="alexa-safe-zone"
          aria-hidden="true"
        />
      </header>

      {/* ── Board subtitle ──────────────────────────────────────────────── */}
      {subtitleEnabled && (
        <div className={styles.boardTitle} data-testid="board-title">
          <span className={styles.boardTitleText}>{subtitleText.toUpperCase()}</span>
        </div>
      )}

      {/* ── Main: event list ─────────────────────────────────────────────── */}
      <main className={styles.main}>
        {feed.isEmpty ? (
          <div className={styles.emptyFull} data-testid="empty-state-full">
            <p className={styles.emptyFullMessage}>
              {feed.emptyStateReason === "DAY_COMPLETED"
                ? "Heute keine weiteren Trainings, Heimspiele oder Turniere."
                : "Heute sind keine Trainings, Heimspiele oder Turniere geplant."}
            </p>
          </div>
        ) : (
          <>
            <ul
              className={styles.eventList}
              role="list"
              data-testid="event-list"
              data-count={visibleDisplayList.length}
            >
              {visibleDisplayList.map((displayItem) => {
                if (displayItem.kind === "training-group") {
                  return (
                    <TrainingGroupCard
                      key={displayItem.items.map((it) => it.event.id).join(":")}
                      items={displayItem.items}
                      timeZone={timeZone}
                      cardCount={visibleDisplayList.length}
                      clubName={clubNameUpper}
                    />
                  );
                }
                const { item } = displayItem;
                const extension = findEventExtension(item.event.id, eventPresentation);
                const allocs = extension?.participantAllocations;
                const participantAllocations =
                  allocs !== undefined && allocs.length >= 3 ? allocs : undefined;
                return (
                  <EventCard
                    key={item.event.id}
                    item={item}
                    timeZone={timeZone}
                    clubLogoSrc={clubLogoSrc}
                    participantAllocations={participantAllocations}
                    eventCount={visibleDisplayList.length}
                  />
                );
              })}
            </ul>

            {overflowCount > 0 && (
              <p
                className={styles.overflowWarning}
                data-testid="overflow-warning"
                role="status"
              >
                WEITERE TERMINE VORHANDEN
              </p>
            )}
          </>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer announcement={announcement} productLogoSrc={productLogoSrc} />
    </div>
  );
}
