/**
 * components/infoboard/screen1/InfoboardScreen1.tsx
 *
 * Infoboard Screen 1 — full-screen TV event schedule board.
 *
 * Design (PP-02B-H — target-aligned premium redesign):
 *   - White schedule surface; dark navy header and footer.
 *   - One flat vertical event list — no section headings.
 *   - Each event is one full-width horizontal row with four CSS grid columns:
 *       STATUS/TIME | EVENT | PITCH | ALLOCATION (ZUTEILUNG)
 *   - Temporal status (JETZT / IN X MIN.) shown inline per row.
 *   - Club branding large in dark header, left side.
 *   - Clock and date in header center-right zone.
 *   - Alexa-safe zone in header far right — intentionally empty.
 *   - SportClubEvo branding in footer, not in header.
 *   - Announcement text in footer left; product branding in footer right.
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

// ── Time / date formatting ────────────────────────────────────────────────────

function formatTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(isoString));
}

function formatWeekday(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    timeZone,
  }).format(new Date(isoString));
}

function formatDateLine(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
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
 * Returns the number of minutes until the event starts.
 * Returns null when the event has already started or times cannot be parsed.
 * Uses only explicit ISO strings — no implicit current time.
 */
function minutesUntil(startAt: string, currentTimeIso: string): number | null {
  const start = new Date(startAt).getTime();
  const now = new Date(currentTimeIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(now)) return null;
  const diff = Math.round((start - now) / 60_000);
  return diff >= 0 ? diff : null;
}

/**
 * Returns the inline status label for an event row.
 *   current → "JETZT"
 *   next + computable → "IN X MIN."
 *   next + not computable → "ALS NÄCHSTES"
 *   later → null (no label)
 */
function statusLabel(
  temporal: TemporalBucket,
  startAt: string,
  currentTimeIso: string | null | undefined,
): string | null {
  if (temporal === "current") return "JETZT";
  if (temporal === "next") {
    if (currentTimeIso != null) {
      const mins = minutesUntil(startAt, currentTimeIso);
      if (mins !== null) return `IN ${mins} MIN.`;
    }
    return "ALS NÄCHSTES";
  }
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

/** Left-stripe accent color key for data attribute. */
function stripeKey(temporal: TemporalBucket, type: PublishingEventType): string {
  if (temporal === "current") return "red";
  if (temporal === "next") return "blue";
  if (type === "MATCH") return "red";
  if (type === "TOURNAMENT") return "orange";
  return "blue"; // training
}

// ── Tournament allocation block ───────────────────────────────────────────────

type ParticipantAllocationBlockProps = {
  allocations: readonly InfoboardTeamAllocationPresentation[];
};

/**
 * Compact allocation matrix for tournaments with ≥ 3 participating teams.
 * Each team is paired explicitly with its dressing room on the same row.
 * When dressingRoomLabel is null, only the team name is shown.
 */
function ParticipantAllocationBlock({
  allocations,
}: ParticipantAllocationBlockProps): ReactElement {
  return (
    <div
      className={styles.participantAllocationBlock}
      data-testid="participant-allocation-block"
    >
      <div className={styles.participantAllocationHeader}>
        <span className={styles.participantHeaderTeam}>TEAM</span>
        <span className={styles.participantHeaderRoom}>GARDEROBE</span>
      </div>
      {allocations.map((alloc) => (
        <div
          key={alloc.id}
          className={
            alloc.isHomeTeam === true
              ? `${styles.participantAllocationRow} ${styles.homeTeamEmphasis}`
              : styles.participantAllocationRow
          }
        >
          <span className={styles.participantTeamName}>
            {alloc.teamDisplayName}
          </span>
          {alloc.dressingRoomLabel !== null && (
            <span className={styles.participantRoomValue}>
              {alloc.dressingRoomLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Match allocation ──────────────────────────────────────────────────────────

type MatchAllocationProps = {
  event: InfoboardScreen1Event;
  clubLogoSrc: string | null;
};

/**
 * Renders explicit home/away team-to-dressing-room pairings for a match.
 * Shows the club logo for the home team when available.
 * No HEIM/GAST labels. No referee room.
 */
function MatchAllocation({ event, clubLogoSrc }: MatchAllocationProps): ReactElement {
  const { homeDressingRoomLabel, awayDressingRoomLabel } = event.allocation;
  const hasHome = homeDressingRoomLabel !== null && event.teamDisplayName !== null;
  const hasAway = awayDressingRoomLabel !== null && event.opponentDisplayName !== null;

  if (!hasHome && !hasAway) {
    return (
      <span
        className={styles.dressingRoomMissing}
        data-testid="dressing-room-unassigned-warning"
      >
        NOCH NICHT ZUGETEILT
      </span>
    );
  }

  return (
    <div className={styles.matchAllocation} data-testid="match-allocation">
      {hasHome && (
        <div className={styles.matchAllocRow}>
          <span className={styles.matchAllocRoom}>{homeDressingRoomLabel}</span>
          <span className={styles.matchAllocLogoSlot} aria-hidden="true">
            {clubLogoSrc !== null && (
              <img
                src={clubLogoSrc}
                alt=""
                className={styles.matchAllocLogo}
                aria-hidden="true"
              />
            )}
          </span>
          <span className={styles.matchAllocTeam}>{event.teamDisplayName}</span>
        </div>
      )}
      {hasAway && (
        <div className={styles.matchAllocRow}>
          <span className={styles.matchAllocRoom}>{awayDressingRoomLabel}</span>
          <span className={styles.matchAllocLogoSlot} aria-hidden="true" />
          <span className={styles.matchAllocTeam}>{event.opponentDisplayName}</span>
        </div>
      )}
    </div>
  );
}

// ── Training allocation ───────────────────────────────────────────────────────

type TrainingAllocationProps = {
  event: InfoboardScreen1Event;
};

function TrainingAllocation({ event }: TrainingAllocationProps): ReactElement {
  const { homeDressingRoomLabel } = event.allocation;

  return (
    <div className={styles.trainingAllocation} data-testid="training-allocation">
      {homeDressingRoomLabel !== null ? (
        <span className={styles.trainingAllocRoom}>{homeDressingRoomLabel}</span>
      ) : (
        <span
          className={styles.dressingRoomMissing}
          data-testid="dressing-room-unassigned-warning"
        >
          NOCH NICHT ZUGETEILT
        </span>
      )}
    </div>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

type EventRowProps = {
  item: FlatEvent;
  timeZone: string;
  currentTimeIso: string | null | undefined;
  clubLogoSrc: string | null;
  participantAllocations: readonly InfoboardTeamAllocationPresentation[] | undefined;
};

function EventRow({
  item,
  timeZone,
  currentTimeIso,
  clubLogoSrc,
  participantAllocations,
}: EventRowProps): ReactElement {
  const { event, temporal } = item;
  const startTime = formatTime(event.startAt, timeZone);
  const isMatch = event.type === "MATCH";
  const isTournament = event.type === "TOURNAMENT";
  const isTournamentMultiTeam =
    participantAllocations !== undefined && participantAllocations.length >= 3;

  const label = statusLabel(temporal, event.startAt, currentTimeIso);
  const stripe = stripeKey(temporal, event.type);

  // Event column: competition/type label
  // Matches show the competition label (e.g. "Meisterschaft") if available, else fallback.
  const typeDisplayLabel = isMatch
    ? (event.competitionLabel ?? EVENT_TYPE_LABELS["MATCH"])
    : EVENT_TYPE_LABELS[event.type] ?? event.type;

  return (
    <li
      className={styles.eventRow}
      data-testid="event-row"
      data-type={event.type}
      data-temporal={temporal}
      data-stripe={stripe}
    >
      {/* ── Column 1: Status / Time ─────────────────────────────────────── */}
      <div className={styles.colTime}>
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
      </div>

      {/* ── Column 2: Event ─────────────────────────────────────────────── */}
      <div className={styles.colEvent}>
        <span
          className={styles.eventTypeLabel}
          data-event-type={event.type}
        >
          {typeDisplayLabel}
        </span>
        {isMatch ? (
          <>
            {event.teamDisplayName !== null && (
              <span className={styles.eventTeamMain}>{event.teamDisplayName}</span>
            )}
            {event.opponentDisplayName !== null && (
              <span className={styles.eventTeamOpponent}>
                vs. {event.opponentDisplayName}
              </span>
            )}
          </>
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

      {/* ── Column 3: Pitch ─────────────────────────────────────────────── */}
      <div className={styles.colPitch}>
        <span className={styles.colLabel}>PLATZ</span>
        {event.allocation.pitchLabel !== null ? (
          <span className={styles.pitchValue}>{event.allocation.pitchLabel}</span>
        ) : (
          <span
            className={styles.pitchMissing}
            data-testid="pitch-unassigned-warning"
          >
            NOCH NICHT ZUGETEILT
          </span>
        )}
      </div>

      {/* ── Column 4: Allocation (ZUTEILUNG) ────────────────────────────── */}
      <div className={styles.colAllocation}>
        <span className={styles.colLabel}>ZUTEILUNG</span>
        {isTournamentMultiTeam ? (
          <ParticipantAllocationBlock allocations={participantAllocations!} />
        ) : isMatch ? (
          <MatchAllocation event={event} clubLogoSrc={clubLogoSrc} />
        ) : (
          <TrainingAllocation event={event} />
        )}
      </div>
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
 * Left: tenant-configurable announcement text (when enabled and non-blank).
 * Right: "POWERED BY" + SportClubEvo product logo.
 *
 * The announcement backgroundColor and textColor override the footer defaults
 * when provided and non-blank.
 *
 * Does not hardcode any club-specific slogan.
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
          <span className={styles.footerAnnouncementText}>{announcement.text}</span>
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
}: InfoboardScreen1Props): ReactElement {
  const { tenant, current, next, later } = feed;
  const timeZone = tenant.timezone;

  const flatList = buildFlatList(feed);
  const totalEvents = flatList.length;

  const overflowCount =
    totalEvents > PROTOTYPE_CAPACITY ? totalEvents - PROTOTYPE_CAPACITY : 0;
  const visibleList = overflowCount > 0
    ? flatList.slice(0, PROTOTYPE_CAPACITY)
    : flatList;

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  // Current time and date — explicit only, never implicit.
  const currentTime =
    currentTimeIso != null ? formatTime(currentTimeIso, timeZone) : null;
  const headerWeekday =
    currentTimeIso != null
      ? formatWeekday(currentTimeIso, timeZone)
      : null;
  const headerDateLine =
    currentTimeIso != null
      ? formatDateLine(currentTimeIso, timeZone)
      : formatDisplayDate(feed.displayDate);

  // Suppress unused-variable warning for later/next (used only in flatList).
  void current; void next; void later;

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen1-root"
      data-theme="dark"
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

        {/* Center zone: current time + date (no product logo here) */}
        <div className={styles.headerCenter} data-testid="header-center">
          {currentTime !== null && headerWeekday !== null ? (
            <>
              <div className={styles.headerTimeBlock}>
                <time
                  className={styles.headerCurrentTime}
                  dateTime={currentTimeIso!}
                >
                  {currentTime}
                </time>
                <span className={styles.headerTimeSeparator} aria-hidden="true">|</span>
                <div className={styles.headerDateBlock}>
                  <span className={styles.headerWeekday}>{headerWeekday}</span>
                  <span className={styles.headerDateLine}>{headerDateLine}</span>
                </div>
              </div>
            </>
          ) : (
            <span className={styles.headerDateFallback}>{headerDateLine}</span>
          )}
        </div>

        {/* Right zone: Alexa-safe — intentionally empty */}
        <div
          className={styles.headerRight}
          data-testid="alexa-safe-zone"
          aria-hidden="true"
        />
      </header>

      {/* ── Board title ──────────────────────────────────────────────────── */}
      <div className={styles.boardTitle} data-testid="board-title">
        <span className={styles.boardTitleText}>HEUTE AUF DER SPORTANLAGE</span>
      </div>

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
            >
              {visibleList.map((item) => {
                const extension = findEventExtension(item.event.id, eventPresentation);
                const allocs = extension?.participantAllocations;
                const participantAllocations =
                  allocs !== undefined && allocs.length >= 3 ? allocs : undefined;
                return (
                  <EventRow
                    key={item.event.id}
                    item={item}
                    timeZone={timeZone}
                    currentTimeIso={currentTimeIso}
                    clubLogoSrc={clubLogoSrc}
                    participantAllocations={participantAllocations}
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
