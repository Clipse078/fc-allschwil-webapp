/**
 * components/infoboard/screen2/InfoboardScreen2.tsx
 *
 * Infoboard Screen 2 — Facility orientation screen.
 *
 * Purpose:
 *   "What is currently happening across the sports facility?"
 *
 * Design (INFOBOARD-04A — premium dark stadium design):
 *   - Full dark navy stadium palette, consistent with Screen 1.
 *   - Left section (dominant): pitch/facility overview with status cards.
 *   - Right section: sponsor display (retained from existing sponsor data).
 *   - Footer: dressing-room orientation quick reference.
 *   - Facility overview shows each pitch as a status card: name, event type
 *     color, current activity, and FREE state when unoccupied.
 *
 * Invariants:
 *   - Pure presentational server component — no "use client", no effects,
 *     no timers, no fetch, no browser storage.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone always taken from feed.tenant.timezone.
 *   - No new Date() without argument; no implicit timezone.
 *   - null / undefined values are never rendered as strings.
 *   - No "Next Events" panel — pitch occupancy only.
 *   - No scrolling — content must fit within 100dvh.
 */

import type { ReactElement } from "react";
import type {
  InfoboardScreen2Feed,
  PitchOccupancy,
  PitchOccupancyState,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import styles from "./InfoboardScreen2.module.css";

// ── Public sponsor types ──────────────────────────────────────────────────────

/**
 * A single sponsor for display purposes.
 * Tier determines visual prominence in the sponsor grid.
 */
export type InfoboardSponsor = {
  readonly id: string;
  readonly name: string;
  readonly logoSrc: string | null;
  readonly tier: "gold" | "silver" | "partner";
};

// ── Public component props ────────────────────────────────────────────────────

export type InfoboardScreen2Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen2Props = {
  feed: InfoboardScreen2Feed;
  branding?: InfoboardScreen2Branding;
  sponsors?: readonly InfoboardSponsor[];
  /**
   * Current moment as a UTC ISO-8601 string.
   * When absent, the clock display falls back to feed.displayDate.
   * Never call new Date() without an argument.
   */
  currentTimeIso?: string | null;
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

// ── Pitch status helpers ──────────────────────────────────────────────────────

function pitchStateLabel(state: PitchOccupancyState): string {
  switch (state) {
    case "OCCUPIED_NOW": return "BELEGT";
    case "FREE_NOW": return "FREI";
    case "UPCOMING": return "DEMNÄCHST";
    case "UNKNOWN": return "UNBEKANNT";
  }
}

function pitchStateKey(state: PitchOccupancyState): string {
  switch (state) {
    case "OCCUPIED_NOW": return "occupied";
    case "FREE_NOW": return "free";
    case "UPCOMING": return "upcoming";
    case "UNKNOWN": return "unknown";
  }
}

function eventTypeKey(type: PublishingEventType): string {
  switch (type) {
    case "MATCH": return "match";
    case "TRAINING": return "training";
    case "TOURNAMENT": return "tournament";
    default: return "other";
  }
}

function eventTypeLabel(type: PublishingEventType): string {
  switch (type) {
    case "MATCH": return "SPIEL";
    case "TRAINING": return "TRAINING";
    case "TOURNAMENT": return "TURNIER";
    default: return "EVENT";
  }
}

// ── Pitch card ────────────────────────────────────────────────────────────────

type PitchCardProps = {
  pitch: PitchOccupancy;
  timeZone: string;
};

function PitchCard({ pitch, timeZone }: PitchCardProps): ReactElement {
  const state = pitch.state;
  const event = pitch.currentEvent ?? pitch.nextEvent;
  const stateKey = pitchStateKey(state);
  const eventKey = event ? eventTypeKey(event.type) : null;

  return (
    <div
      className={styles.pitchCard}
      data-testid="pitch-card"
      data-state={stateKey}
      data-event-type={eventKey ?? undefined}
    >
      {/* Pitch name */}
      <div className={styles.pitchCardName} data-testid="pitch-card-name">
        {pitch.displayLabel}
      </div>

      {/* Status badge */}
      <div
        className={styles.pitchCardStatus}
        data-state={stateKey}
        data-testid="pitch-card-status"
      >
        {pitchStateLabel(state)}
      </div>

      {/* Event summary when occupied or upcoming */}
      {event !== null ? (
        <div className={styles.pitchCardEvent} data-testid="pitch-card-event">
          <span
            className={styles.pitchCardEventType}
            data-event-type={eventTypeKey(event.type)}
          >
            {eventTypeLabel(event.type)}
          </span>
          <span className={styles.pitchCardEventTitle}>
            {event.teamDisplayName ?? event.displayTitle}
          </span>
          <span className={styles.pitchCardEventTime}>
            {formatTime(event.startAt, timeZone)}
          </span>
        </div>
      ) : (
        <div className={styles.pitchCardFree} data-testid="pitch-card-free">
          <span className={styles.pitchCardFreeLine}>VERFÜGBAR</span>
        </div>
      )}
    </div>
  );
}

// ── Sponsor section ───────────────────────────────────────────────────────────

type SponsorSectionProps = {
  sponsors: readonly InfoboardSponsor[];
};

function SponsorSection({ sponsors }: SponsorSectionProps): ReactElement {
  const goldSponsors = sponsors.filter((s) => s.tier === "gold");
  const silverSponsors = sponsors.filter((s) => s.tier === "silver");
  const partnerSponsors = sponsors.filter((s) => s.tier === "partner");

  return (
    <section
      className={styles.sponsorSection}
      data-testid="sponsor-section"
      aria-label="Unsere Sponsoren"
    >
      <div className={styles.sponsorSectionHeader}>
        <span className={styles.sponsorSectionTitle}>UNSERE SPONSOREN</span>
      </div>

      <div className={styles.sponsorGrid} data-testid="sponsor-grid">
        {/* Gold: full-width prominent */}
        {goldSponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`${styles.sponsorCard} ${styles.sponsorCardGold}`}
            data-testid="sponsor-card"
            data-tier="gold"
          >
            {sponsor.logoSrc !== null ? (
              <img
                src={sponsor.logoSrc}
                alt={sponsor.name}
                className={styles.sponsorLogo}
                data-testid="sponsor-logo"
              />
            ) : (
              <span className={styles.sponsorName}>{sponsor.name}</span>
            )}
          </div>
        ))}

        {/* Silver: half-width */}
        {silverSponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`${styles.sponsorCard} ${styles.sponsorCardSilver}`}
            data-testid="sponsor-card"
            data-tier="silver"
          >
            {sponsor.logoSrc !== null ? (
              <img
                src={sponsor.logoSrc}
                alt={sponsor.name}
                className={styles.sponsorLogo}
                data-testid="sponsor-logo"
              />
            ) : (
              <span className={styles.sponsorName}>{sponsor.name}</span>
            )}
          </div>
        ))}

        {/* Partner: smaller cells */}
        {partnerSponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`${styles.sponsorCard} ${styles.sponsorCardPartner}`}
            data-testid="sponsor-card"
            data-tier="partner"
          >
            {sponsor.logoSrc !== null ? (
              <img
                src={sponsor.logoSrc}
                alt={sponsor.name}
                className={styles.sponsorLogo}
                data-testid="sponsor-logo"
              />
            ) : (
              <span className={styles.sponsorName}>{sponsor.name}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen2({
  feed,
  branding,
  sponsors = [],
  currentTimeIso,
}: InfoboardScreen2Props): ReactElement {
  const { tenant, pitches } = feed;
  const timeZone = tenant.timezone;

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  const currentTime =
    currentTimeIso != null ? formatTime(currentTimeIso, timeZone) : null;
  const headerWeekday =
    currentTimeIso != null ? formatWeekday(currentTimeIso, timeZone) : null;
  const headerDateLine =
    currentTimeIso != null
      ? formatDateLine(currentTimeIso, timeZone)
      : formatDisplayDate(feed.displayDate);

  const hasPitches = pitches.length > 0;

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen2-root"
      data-theme="dark"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header} data-testid="infoboard-screen2-header">

        {/* Left: club branding */}
        <div className={styles.headerLeft} data-testid="screen2-header-left">
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
          <div className={styles.headerBranding}>
            <span className={styles.headerClubName}>{tenant.name}</span>
            <span className={styles.headerFacilityName}>{feed.facilityName}</span>
          </div>
        </div>

        {/* Center: current time + date */}
        <div className={styles.headerCenter} data-testid="screen2-header-center">
          {currentTime !== null && headerWeekday !== null ? (
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
          ) : (
            <span className={styles.headerDateFallback}>{headerDateLine}</span>
          )}
        </div>

        {/* Right: Alexa-safe zone — intentionally empty */}
        <div
          className={styles.headerRight}
          data-testid="screen2-alexa-safe-zone"
          aria-hidden="true"
        />
      </header>

      {/* ── Main content: facility overview + sponsors ────────────────────── */}
      <main className={styles.main}>

        {/* Left column: pitch overview */}
        <section
          className={styles.facilitySection}
          aria-label="Feldbelegung"
          data-testid="facility-overview"
        >
          <div className={styles.facilitySectionTitle}>
            <span className={styles.sectionLabel}>FELDBELEGUNG</span>
          </div>

          {hasPitches ? (
            <div
              className={styles.pitchGrid}
              data-testid="pitch-grid"
              data-count={pitches.length}
            >
              {pitches.map((pitch) => (
                <PitchCard
                  key={pitch.code}
                  pitch={pitch}
                  timeZone={timeZone}
                />
              ))}
            </div>
          ) : (
            <div className={styles.pitchGridEmpty} data-testid="pitch-grid-empty">
              <span className={styles.pitchGridEmptyText}>
                KEINE FELDDATEN VERFÜGBAR
              </span>
            </div>
          )}
        </section>

        {/* Right column: sponsor section */}
        <aside className={styles.sponsorAside} data-testid="sponsor-aside">
          <SponsorSection sponsors={sponsors} />
        </aside>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className={styles.footer} data-testid="screen2-footer">
        <div className={styles.footerLeft}>
          <span className={styles.footerFacility}>{feed.facilityName}</span>
        </div>
        <div className={styles.footerRight} data-testid="screen2-product-branding">
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
    </div>
  );
}
