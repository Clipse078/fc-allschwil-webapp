/**
 * components/infoboard/screen1/InfoboardScreen1.tsx
 *
 * Infoboard Screen 1 — full-screen TV event schedule board.
 *
 * Design constraints (PP-02B / PP-02B-F):
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
 *
 * Density strategy:
 *   totalEvents = current.length + next.length + later.length
 *   NORMAL  → total ≤ 5  (generous spacing, largest type)
 *   COMPACT → total 6–11 (reduced gaps, slightly smaller later-section type)
 *   PROTOTYPE_CAPACITY = 12: if total > 12, show overflow warning and render
 *   only up to that capacity. No pagination, no carousel, no rotation.
 *
 * Simultaneous-event density (per section):
 *   NORMAL → max group-by-startAt count < 4
 *   HIGH   → max group-by-startAt count ≥ 4 (compact row layout used)
 *
 * Multi-team allocation:
 *   When eventPresentation supplies participantAllocations.length ≥ 3 for an
 *   event, the event renders in tournament allocation-matrix mode.
 */

import type { ReactElement } from "react";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  InfoboardAllocationDisplay,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardTeamAllocationPresentation,
  InfoboardEventPresentationExtension,
} from "./screen1-presentation-types";
import styles from "./InfoboardScreen1.module.css";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Prototype max events rendered before showing overflow warning. */
const PROTOTYPE_CAPACITY = 12;

/** Normal/compact density boundary. */
const COMPACT_THRESHOLD = 6;

/** Simultaneous-event count that triggers high-density compact row layout. */
const HIGH_DENSITY_THRESHOLD = 4;

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

// ── Event-type labels (presentation-only, German) ─────────────────────────────

const EVENT_TYPE_LABELS: Record<PublishingEventType, string> = {
  TRAINING: "TRAINING",
  MATCH: "SPIEL",
  TOURNAMENT: "TURNIER",
  OTHER: "EVENT",
  VACATION_PERIOD: "FERIENBLOCK",
};

// ── Time / date formatting ────────────────────────────────────────────────────

/**
 * Formats a UTC ISO-8601 string to HH:mm in the given IANA timezone.
 * Uses Intl.DateTimeFormat with an explicit timeZone — never relies on
 * server-local or browser-local timezone.
 */
function formatTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(isoString));
}

/**
 * Formats a UTC ISO-8601 timestamp to a long German date string using the
 * given explicit IANA timezone. CSS text-transform: uppercase is responsible
 * for the visual uppercase presentation.
 *
 * Example: "Samstag, 12. September 2026" → CSS uppercase → "SAMSTAG, 12. SEPTEMBER 2026"
 */
function formatCurrentDate(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(isoString));
}

/**
 * Formats the display date (YYYY-MM-DD) for the header as a German long date.
 * Parses the date-only string at noon UTC to avoid any TZ edge cases.
 * Used as fallback when currentTimeIso is not supplied.
 */
function formatDisplayDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the first event presentation extension matching eventId.
 * Unknown IDs are ignored; duplicate IDs use first match.
 * Does not mutate the extensions array.
 */
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

/**
 * Determines the simultaneous-event density for a section.
 * Groups events by startAt and returns "high" when any group has ≥ HIGH_DENSITY_THRESHOLD.
 * Uses event count and shared start time only — no DOM measurement.
 */
function getSimultaneousDensity(
  events: readonly InfoboardScreen1Event[],
): "normal" | "high" {
  if (events.length < HIGH_DENSITY_THRESHOLD) return "normal";
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.startAt, (counts.get(event.startAt) ?? 0) + 1);
  }
  let max = 0;
  for (const count of counts.values()) {
    if (count > max) max = count;
  }
  return max >= HIGH_DENSITY_THRESHOLD ? "high" : "normal";
}

// ── Allocation helpers ────────────────────────────────────────────────────────

type AllocationProps = {
  allocation: InfoboardAllocationDisplay;
  eventType: PublishingEventType;
};

/**
 * Renders the standard allocation block (pitch + dressing rooms).
 * Referee dressing room is intentionally not rendered on Screen 1.
 */
function AllocationBlock({ allocation, eventType }: AllocationProps): ReactElement | null {
  const {
    pitchLabel,
    homeDressingRoomLabel,
    awayDressingRoomLabel,
  } = allocation;

  const isMatch = eventType === "MATCH";

  // refereeDressingRoomLabel is intentionally excluded from Screen 1 display.
  const hasAny =
    pitchLabel !== null ||
    homeDressingRoomLabel !== null ||
    awayDressingRoomLabel !== null;

  if (!hasAny) return null;

  return (
    <div className={styles.allocation} data-testid="allocation-block">
      {pitchLabel !== null && (
        <span className={styles.allocationPitch}>
          <span className={styles.allocationLabel} aria-hidden="true">PLATZ</span>
          <span className={styles.allocationValue}>{pitchLabel}</span>
        </span>
      )}
      {isMatch ? (
        <>
          {homeDressingRoomLabel !== null && (
            <span className={styles.allocationHome}>
              <span className={styles.allocationLabel} aria-hidden="true">HEIM</span>
              <span className={styles.allocationValue}>{homeDressingRoomLabel}</span>
            </span>
          )}
          {awayDressingRoomLabel !== null && (
            <span className={styles.allocationAway}>
              <span className={styles.allocationLabel} aria-hidden="true">GAST</span>
              <span className={styles.allocationValue}>{awayDressingRoomLabel}</span>
            </span>
          )}
        </>
      ) : (
        homeDressingRoomLabel !== null && (
          <span className={styles.allocationHome}>
            <span className={styles.allocationLabel} aria-hidden="true">GARDEROBE</span>
            <span className={styles.allocationValue}>{homeDressingRoomLabel}</span>
          </span>
        )
      )}
    </div>
  );
}

// ── Multi-team allocation block ───────────────────────────────────────────────

type ParticipantAllocationBlockProps = {
  allocations: readonly InfoboardTeamAllocationPresentation[];
};

/**
 * Renders the two-column TEAM | GARDEROBE allocation matrix for tournaments
 * with three or more participating teams. Each team is explicitly paired with
 * its assigned dressing room on the same row.
 *
 * When dressingRoomLabel is null, only the team row is rendered and the room
 * cell is omitted — no placeholder dash.
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

// ── Event card ────────────────────────────────────────────────────────────────

type EventCardProps = {
  event: InfoboardScreen1Event;
  timeZone: string;
  size: "large" | "medium" | "small";
  participantAllocations?: readonly InfoboardTeamAllocationPresentation[];
};

function EventCard({
  event,
  timeZone,
  size,
  participantAllocations,
}: EventCardProps): ReactElement {
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
  const startTime = formatTime(event.startAt, timeZone);
  const isMatch = event.type === "MATCH";
  const hasPairing = isMatch && event.opponentDisplayName !== null;

  const isTournamentMultiTeam =
    participantAllocations !== undefined &&
    participantAllocations.length >= 3;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-card"
      data-size={size}
      data-type={event.type}
      data-tournament-mode={isTournamentMultiTeam ? "multi-team" : undefined}
      data-status={event.status}
    >
      {/* Time + type label */}
      <div className={styles.eventMeta}>
        <time
          dateTime={event.startAt}
          className={styles.eventTime}
        >
          {startTime}
        </time>
        <span className={styles.eventTypeLabel} aria-label={`Typ: ${typeLabel}`}>
          {typeLabel}
        </span>
        {event.status === "LIVE" && (
          <span className={styles.liveIndicator} aria-label="Läuft jetzt">
            LIVE
          </span>
        )}
      </div>

      {isTournamentMultiTeam ? (
        /* ── Multi-team tournament allocation mode ─────────────────────── */
        <div className={styles.eventTournamentContent}>
          <div className={styles.tournamentTitle}>{event.displayTitle}</div>
          {event.allocation.pitchLabel !== null && (
            <span className={styles.allocationPitch}>
              <span className={styles.allocationLabel} aria-hidden="true">PLATZ</span>
              <span className={styles.allocationValue}>
                {event.allocation.pitchLabel}
              </span>
            </span>
          )}
          <ParticipantAllocationBlock allocations={participantAllocations} />
        </div>
      ) : (
        /* ── Standard event mode ───────────────────────────────────────── */
        <>
          {/* Team / pairing */}
          <div className={styles.eventTeams}>
            {hasPairing ? (
              <>
                <span className={styles.eventTeamHome}>{event.teamDisplayName}</span>
                <span className={styles.eventVs} aria-hidden="true">vs.</span>
                <span className={styles.eventTeamAway}>{event.opponentDisplayName}</span>
              </>
            ) : (
              event.teamDisplayName !== null && (
                <span className={styles.eventTeamSingle}>{event.teamDisplayName}</span>
              )
            )}
            {!isMatch && event.displayTitle && event.teamDisplayName === null && (
              <span className={styles.eventTeamSingle}>{event.displayTitle}</span>
            )}
          </div>

          {/* Competition — only when present */}
          {event.competitionLabel !== null && (
            <div className={styles.eventCompetition}>{event.competitionLabel}</div>
          )}

          {/* Standard allocation (no referee on Screen 1) */}
          <AllocationBlock allocation={event.allocation} eventType={event.type} />
        </>
      )}
    </li>
  );
}

// ── Compact event row (high-density mode) ─────────────────────────────────────

type CompactEventRowProps = {
  event: InfoboardScreen1Event;
  timeZone: string;
};

/**
 * Compact horizontal row for high-density sections (4–6 simultaneous events).
 * Shows: time · team · pitch · dressing room.
 * Text size is never smaller than the later-event minimum.
 */
function CompactEventRow({ event, timeZone }: CompactEventRowProps): ReactElement {
  const startTime = formatTime(event.startAt, timeZone);
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
  const { pitchLabel, homeDressingRoomLabel } = event.allocation;

  return (
    <li
      className={styles.compactEventRow}
      data-testid="compact-event-row"
      data-type={event.type}
      data-status={event.status}
    >
      <time className={styles.compactTime} dateTime={event.startAt}>
        {startTime}
      </time>
      <span className={styles.compactTypeLabel}>{typeLabel}</span>
      {event.teamDisplayName !== null && (
        <span className={styles.compactTeam}>{event.teamDisplayName}</span>
      )}
      <div className={styles.compactAllocation}>
        {pitchLabel !== null && (
          <span className={styles.compactPitch}>{pitchLabel}</span>
        )}
        {homeDressingRoomLabel !== null && (
          <span className={styles.compactRoom}>{homeDressingRoomLabel}</span>
        )}
      </div>
    </li>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

type SectionVariant = "current" | "next" | "later";

const SECTION_VARIANT_STYLES: Record<SectionVariant, string> = {
  current: styles.sectionCurrent,
  next: styles.sectionNext,
  later: styles.sectionLater,
};

const SECTION_TEST_IDS: Record<SectionVariant, string> = {
  current: "section-current",
  next: "section-next",
  later: "section-later",
};

type SectionProps = {
  heading: string;
  events: InfoboardScreen1Event[];
  timeZone: string;
  cardSize: "large" | "medium" | "small";
  variant: SectionVariant;
  emptyMessage?: string;
  eventPresentation?: readonly InfoboardEventPresentationExtension[];
};

function Section({
  heading,
  events,
  timeZone,
  cardSize,
  variant,
  emptyMessage,
  eventPresentation,
}: SectionProps): ReactElement {
  const variantClass = SECTION_VARIANT_STYLES[variant] ?? "";
  const testId = SECTION_TEST_IDS[variant];
  const simultaneousDensity = getSimultaneousDensity(events);

  return (
    <section
      className={`${styles.section} ${variantClass}`}
      data-testid={testId}
      data-simultaneous-density={simultaneousDensity}
    >
      <h2 className={styles.sectionHeading}>{heading}</h2>
      {events.length === 0 ? (
        emptyMessage !== undefined ? (
          <p className={styles.sectionEmpty}>{emptyMessage}</p>
        ) : null
      ) : simultaneousDensity === "high" ? (
        /* High-density: compact rows for 4–6 simultaneous events */
        <ul className={styles.compactEventList} role="list">
          {events.map((event) => (
            <CompactEventRow
              key={event.id}
              event={event}
              timeZone={timeZone}
            />
          ))}
        </ul>
      ) : (
        /* Normal density: standard event cards */
        <ul className={styles.eventList} role="list">
          {events.map((event) => {
            const extension = findEventExtension(event.id, eventPresentation);
            const allocs = extension?.participantAllocations;
            const participantAllocations =
              allocs !== undefined && allocs.length >= 3 ? allocs : undefined;
            return (
              <EventCard
                key={event.id}
                event={event}
                timeZone={timeZone}
                size={cardSize}
                participantAllocations={participantAllocations}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Announcement bar ──────────────────────────────────────────────────────────

type AnnouncementBarProps = {
  announcement: InfoboardAnnouncementPresentation;
};

/**
 * Bottom announcement strip. Renders only when:
 *   - announcement.enabled is true, and
 *   - announcement.text contains meaningful non-whitespace content.
 *
 * Uses backgroundColor and textColor when provided and non-blank.
 * Falls back to CSS defaults (blue bar, white text) when absent.
 * Does not hardcode any club-specific content.
 */
function AnnouncementBar({ announcement }: AnnouncementBarProps): ReactElement | null {
  if (!announcement.enabled) return null;
  if (typeof announcement.text !== "string") return null;
  if (announcement.text.trim().length === 0) return null;

  const inlineStyle: React.CSSProperties = {};
  if (announcement.backgroundColor && announcement.backgroundColor.trim().length > 0) {
    inlineStyle.backgroundColor = announcement.backgroundColor;
  }
  if (announcement.textColor && announcement.textColor.trim().length > 0) {
    inlineStyle.color = announcement.textColor;
  }

  return (
    <div
      className={styles.announcementBar}
      data-testid="announcement-bar"
      style={inlineStyle}
    >
      <span className={styles.announcementText}>{announcement.text}</span>
    </div>
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

  const totalEvents = current.length + next.length + later.length;
  const density: "normal" | "compact" =
    totalEvents >= COMPACT_THRESHOLD ? "compact" : "normal";

  const overflowCount = totalEvents > PROTOTYPE_CAPACITY
    ? totalEvents - PROTOTYPE_CAPACITY
    : 0;

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  // Current time and date — explicit only, never implicit.
  const currentTime =
    currentTimeIso != null ? formatTime(currentTimeIso, timeZone) : null;
  const headerDate =
    currentTimeIso != null
      ? formatCurrentDate(currentTimeIso, timeZone)
      : formatDisplayDate(feed.displayDate);

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen1-root"
      data-density={density}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header} data-testid="infoboard-header">

        {/* Left zone: club branding */}
        <div className={styles.headerLeft}>
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
          <div className={styles.headerNames}>
            <span className={styles.headerClubName}>{tenant.name}</span>
          </div>
        </div>

        {/* Center zone: SportClubEvo logo + current time + current date */}
        <div className={styles.headerCenter} data-testid="header-center">
          <div className={styles.headerProduct} data-testid="product-branding">
            {productLogoSrc !== null ? (
              <img
                src={productLogoSrc}
                alt="SportClubEvo"
                className={styles.productLogo}
                width={80}
                height={24}
              />
            ) : (
              <span className={styles.productLogoFallback}>SportClubEvo</span>
            )}
          </div>
          {currentTime !== null && (
            <time
              className={styles.headerCurrentTime}
              dateTime={currentTimeIso!}
            >
              {currentTime}
            </time>
          )}
          <span className={styles.headerDate}>{headerDate}</span>
        </div>

        {/* Right zone: Alexa-safe — intentionally empty */}
        <div
          className={styles.headerRight}
          data-testid="alexa-safe-zone"
          aria-hidden="true"
        />
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className={styles.main}>
        {feed.isEmpty ? (
          /* Full empty state */
          <div className={styles.emptyFull} data-testid="empty-state-full">
            <p className={styles.emptyFullMessage}>
              Heute keine Trainings, Heimspiele oder Turniere
            </p>
          </div>
        ) : (
          <>
            {/* JETZT */}
            <Section
              heading="JETZT"
              events={current}
              timeZone={timeZone}
              cardSize="large"
              variant="current"
              emptyMessage="Aktuell keine Veranstaltung"
              eventPresentation={eventPresentation}
            />

            {/* ALS NÄCHSTES */}
            {next.length > 0 && (
              <Section
                heading="ALS NÄCHSTES"
                events={next}
                timeZone={timeZone}
                cardSize="medium"
                variant="next"
                eventPresentation={eventPresentation}
              />
            )}

            {/* SPÄTER HEUTE */}
            {later.length > 0 && (
              <Section
                heading="SPÄTER HEUTE"
                events={later}
                timeZone={timeZone}
                cardSize="small"
                variant="later"
                eventPresentation={eventPresentation}
              />
            )}

            {/* Overflow warning — only when prototype capacity exceeded */}
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

      {/* ── Announcement bar ─────────────────────────────────────────────── */}
      {announcement !== undefined && (
        <AnnouncementBar announcement={announcement} />
      )}
    </div>
  );
}
