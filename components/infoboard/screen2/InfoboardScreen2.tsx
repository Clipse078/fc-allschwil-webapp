/**
 * components/infoboard/screen2/InfoboardScreen2.tsx
 *
 * Infoboard Screen 2 — Facility orientation screen.
 *
 * Purpose:
 *   "What is currently happening across the sports facility?"
 *
 * Design (INFOBOARD-04B — premium dark facility overview):
 *   - Full dark navy stadium palette, consistent with Screen 1.
 *   - Left section (~65% width, dominant): large pitch overview cards.
 *   - Right section (~35% width): weather panel + sponsor display.
 *   - Pitch cards fill the available facility area.
 *
 * INFOBOARD-05 changes:
 *   - Dressing-room/cabin section removed from Screen 2.
 *     Cabin assignments belong exclusively on Screen 1.
 *   - Weather panel added to the right column (above sponsors).
 *
 * Invariants:
 *   - Pure presentational server component — no "use client", no effects,
 *     no timers, no fetch, no browser storage.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone always taken from feed.tenant.timezone.
 *   - No new Date() without argument; no implicit timezone.
 *   - null / undefined values are never rendered as strings.
 *   - No "Next Events" panel — pitch occupancy only.
 *   - No dressing-room / cabin section.
 *   - No scrolling — content must fit within 100dvh.
 */

import type { ReactElement } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  Zap,
  CloudDrizzle,
  Wind,
} from "lucide-react";
import type {
  InfoboardScreen2Feed,
  PitchOccupancy,
  PitchOccupancyState,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type { WeatherResult } from "@/lib/weather/weather-types";
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
   * Current weather for the facility location.
   * When absent or unavailable, renders the "WETTER NICHT VERFÜGBAR" fallback.
   */
  weather?: WeatherResult | null;
  /**
   * Current moment as a UTC ISO-8601 string.
   * When absent, the clock display falls back to feed.displayDate.
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
    case "FREE_NOW":     return "FREI";
    case "UPCOMING":     return "DEMNÄCHST";
    case "UNKNOWN":      return "UNBEKANNT";
  }
}

function pitchStateKey(state: PitchOccupancyState): string {
  switch (state) {
    case "OCCUPIED_NOW": return "occupied";
    case "FREE_NOW":     return "free";
    case "UPCOMING":     return "upcoming";
    case "UNKNOWN":      return "unknown";
  }
}

function eventTypeKey(type: PublishingEventType): string {
  switch (type) {
    case "MATCH":      return "match";
    case "TRAINING":   return "training";
    case "TOURNAMENT": return "tournament";
    default:           return "other";
  }
}

function eventTypeLabel(type: PublishingEventType): string {
  switch (type) {
    case "MATCH":      return "SPIEL";
    case "TRAINING":   return "TRAINING";
    case "TOURNAMENT": return "TURNIER";
    default:           return "EVENT";
  }
}

// ── Weather icon helper ───────────────────────────────────────────────────────

type LucideIconProps = { size?: number; strokeWidth?: number; "aria-hidden"?: boolean };
type LucideIcon = (props: LucideIconProps) => ReactElement;

function getWeatherIcon(conditionCode: number): LucideIcon {
  if (conditionCode === 0 || conditionCode === 1) return Sun as LucideIcon;
  if (conditionCode === 2) return CloudSun as LucideIcon;
  if (conditionCode === 3) return Cloud as LucideIcon;
  if (conditionCode >= 45 && conditionCode <= 48) return Cloud as LucideIcon;
  if (conditionCode >= 51 && conditionCode <= 57) return CloudDrizzle as LucideIcon;
  if (conditionCode >= 61 && conditionCode <= 67) return CloudRain as LucideIcon;
  if (conditionCode >= 71 && conditionCode <= 77) return CloudSnow as LucideIcon;
  if (conditionCode >= 80 && conditionCode <= 82) return CloudRain as LucideIcon;
  if (conditionCode >= 85 && conditionCode <= 86) return CloudSnow as LucideIcon;
  if (conditionCode >= 95) return Zap as LucideIcon;
  return Cloud as LucideIcon;
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
          {event.opponentDisplayName !== null && (
            <span className={styles.pitchCardEventOpponent}>
              vs. {event.opponentDisplayName}
            </span>
          )}
          <span className={styles.pitchCardEventTime}>
            {formatTime(event.startAt, timeZone)}
            {event.endAt !== null && (
              <span className={styles.pitchCardEventEndTime}>
                {" "}–{formatTime(event.endAt, timeZone)}
              </span>
            )}
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

// ── Weather panel ─────────────────────────────────────────────────────────────

type WeatherPanelProps = {
  weather: WeatherResult | null | undefined;
};

function WeatherPanel({ weather }: WeatherPanelProps): ReactElement {
  const isAvailable = weather?.isAvailable === true;

  if (!isAvailable || !weather) {
    return (
      <section
        className={styles.weatherPanel}
        data-testid="weather-panel"
        aria-label="Wetter"
      >
        <div className={styles.weatherPanelHeader}>
          <span className={styles.weatherPanelTitle}>WETTER</span>
        </div>
        <div
          className={styles.weatherUnavailable}
          data-testid="weather-unavailable"
        >
          <span>WETTER NICHT VERFÜGBAR</span>
        </div>
      </section>
    );
  }

  const w = weather;
  const IconComponent = getWeatherIcon(w.conditionCode);

  return (
    <section
      className={styles.weatherPanel}
      data-testid="weather-panel"
      aria-label="Wetter"
    >
      <div className={styles.weatherPanelHeader}>
        <span className={styles.weatherPanelTitle}>WETTER</span>
      </div>
      <div className={styles.weatherBody} data-testid="weather-body">
        <div className={styles.weatherTempBlock}>
          <span className={styles.weatherTemp} data-testid="weather-temperature">
            {w.temperatureC}
            <span className={styles.weatherTempUnit}>&thinsp;°C</span>
          </span>
        </div>
        <div className={styles.weatherDetails}>
          <div className={styles.weatherIconCondition}>
            <IconComponent
              size={20}
              strokeWidth={1.5}
              aria-hidden={true}
            />
            <span
              className={styles.weatherCondition}
              data-testid="weather-condition"
            >
              {w.conditionLabel}
            </span>
          </div>
          <div className={styles.weatherWindRow}>
            <Wind size={14} strokeWidth={1.5} aria-hidden={true} />
            <span
              className={styles.weatherWind}
              data-testid="weather-wind"
            >
              {w.windKmh}&thinsp;km/h
            </span>
          </div>
        </div>
      </div>
      {/* Attribution required by MeteoSwiss OGD terms: "Source: MeteoSwiss" */}
      <div
        className={styles.weatherAttribution}
        data-testid="weather-attribution"
        aria-label="Wetterdaten-Quelle"
      >
        Quelle: MeteoSwiss
      </div>
    </section>
  );
}

// ── Sponsor section ───────────────────────────────────────────────────────────

type SponsorSectionProps = {
  sponsors: readonly InfoboardSponsor[];
};

function SponsorSection({ sponsors }: SponsorSectionProps): ReactElement | null {
  if (sponsors.length === 0) {
    return null;
  }

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
  weather,
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

      {/* ── Main content: facility | weather + sponsors ───────────────────── */}
      <main className={styles.main}>

        {/* Left column: pitch overview */}
        <div className={styles.facilityColumn}>

          {/* Pitch overview */}
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
        </div>

        {/* Right column: weather + sponsors */}
        <aside className={styles.sponsorAside} data-testid="sponsor-aside">
          <WeatherPanel weather={weather} />
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
