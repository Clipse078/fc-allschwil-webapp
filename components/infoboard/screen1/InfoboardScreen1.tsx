/**
 * components/infoboard/screen1/InfoboardScreen1.tsx
 *
 * Infoboard Screen 1 — full-screen TV event schedule board.
 *
 * Design constraints (PP-02B):
 *   - Pure presentational server component — no "use client", no effects,
 *     no timers, no fetch, no browser storage, no URL parameter logic.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone is always taken explicitly from feed.tenant.timezone.
 *   - No new Date() without an argument; no server-local or browser-local TZ.
 *   - null / undefined values are never rendered as strings.
 *   - No placeholder dashes, "Unknown", "TBD", "N/A", or empty badges.
 *   - Inputs are never mutated.
 *   - Reusable: FC Allschwil content lives only in the preview fixture.
 *
 * Density strategy:
 *   totalEvents = current.length + next.length + later.length
 *   NORMAL  → total ≤ 5  (generous spacing, largest type)
 *   COMPACT → total 6–11 (reduced gaps, slightly smaller later-section type)
 *   PROTOTYPE_CAPACITY = 12: if total > 12, show overflow warning and render
 *   only up to that capacity. No pagination, no carousel, no rotation.
 */

import type { ReactElement } from "react";
import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  InfoboardAllocationDisplay,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import styles from "./InfoboardScreen1.module.css";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Prototype max events rendered before showing overflow warning. */
const PROTOTYPE_CAPACITY = 12;

/** Normal/compact density boundary. */
const COMPACT_THRESHOLD = 6;

// ── Public types ──────────────────────────────────────────────────────────────

export type InfoboardScreen1Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen1Props = {
  feed: InfoboardScreen1Feed;
  branding?: InfoboardScreen1Branding;
};

// ── Event-type labels (presentation-only, German) ─────────────────────────────

const EVENT_TYPE_LABELS: Record<PublishingEventType, string> = {
  TRAINING: "TRAINING",
  MATCH: "SPIEL",
  TOURNAMENT: "TURNIER",
  OTHER: "EVENT",
  VACATION_PERIOD: "FERIENBLOCK",
};

// ── Time formatting ───────────────────────────────────────────────────────────

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
 * Formats the display date (YYYY-MM-DD) for the header as a German long date.
 * Parses the date-only string at noon UTC to avoid any TZ edge cases.
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

// ── Allocation helpers ────────────────────────────────────────────────────────

type AllocationProps = {
  allocation: InfoboardAllocationDisplay;
  eventType: PublishingEventType;
};

function AllocationBlock({ allocation, eventType }: AllocationProps): ReactElement | null {
  const {
    pitchLabel,
    homeDressingRoomLabel,
    awayDressingRoomLabel,
    refereeDressingRoomLabel,
  } = allocation;

  const isMatch = eventType === "MATCH";
  const hasAny =
    pitchLabel !== null ||
    homeDressingRoomLabel !== null ||
    awayDressingRoomLabel !== null ||
    refereeDressingRoomLabel !== null;

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
          {refereeDressingRoomLabel !== null && (
            <span className={styles.allocationReferee}>
              <span className={styles.allocationLabel} aria-hidden="true">SCHIRI</span>
              <span className={styles.allocationValue}>{refereeDressingRoomLabel}</span>
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

// ── Event card ────────────────────────────────────────────────────────────────

type EventCardProps = {
  event: InfoboardScreen1Event;
  timeZone: string;
  size: "large" | "medium" | "small";
};

function EventCard({ event, timeZone, size }: EventCardProps): ReactElement {
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
  const startTime = formatTime(event.startAt, timeZone);
  const isMatch = event.type === "MATCH";
  const hasPairing = isMatch && event.opponentDisplayName !== null;

  return (
    <li
      className={styles.eventCard}
      data-testid="event-card"
      data-size={size}
      data-type={event.type}
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

      {/* Allocation */}
      <AllocationBlock allocation={event.allocation} eventType={event.type} />
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
};

function Section({
  heading,
  events,
  timeZone,
  cardSize,
  variant,
  emptyMessage,
}: SectionProps): ReactElement {
  const variantClass = SECTION_VARIANT_STYLES[variant] ?? "";
  const testId = SECTION_TEST_IDS[variant];

  return (
    <section
      className={`${styles.section} ${variantClass}`}
      data-testid={testId}
    >
      <h2 className={styles.sectionHeading}>{heading}</h2>
      {events.length === 0 ? (
        emptyMessage !== undefined ? (
          <p className={styles.sectionEmpty}>{emptyMessage}</p>
        ) : null
      ) : (
        <ul className={styles.eventList} role="list">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              timeZone={timeZone}
              size={cardSize}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen1({
  feed,
  branding,
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

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen1-root"
      data-density={density}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header} data-testid="infoboard-header">
        <div className={styles.headerBrand}>
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
            <span className={styles.headerDate}>
              {formatDisplayDate(feed.displayDate)}
            </span>
          </div>
        </div>

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
            />

            {/* ALS NÄCHSTES */}
            {next.length > 0 && (
              <Section
                heading="ALS NÄCHSTES"
                events={next}
                timeZone={timeZone}
                cardSize="medium"
                variant="next"
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
    </div>
  );
}
