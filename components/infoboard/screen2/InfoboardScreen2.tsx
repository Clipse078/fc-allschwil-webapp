/**
 * components/infoboard/screen2/InfoboardScreen2.tsx
 *
 * Infoboard Screen 2 — FACILITY OVERVIEW.
 *
 * Purpose:
 *   "What is happening on each facility/resource now, and what is next?"
 *   (Screen 1 answers the club-wide "what's happening now and in the next
 *   few hours" question; Screen 2 is resource/facility-oriented and never
 *   duplicates Screen 1's event-list presentation.)
 *
 * Sections:
 *   - HEADER — club branding, a reserved Alexa-integration zone, and a
 *     compact weather indicator alongside the time/date block
 *     (INFOBOARD-INTEGRATION-01C-C1).
 *   - PITCHES — a card per configured pitch/hall, showing JETZT (current)
 *     and DANACH (next-within-horizon) independently, or FREI when neither
 *     exists. Uses the full content width — there is no sponsor/weather
 *     sidebar (INFOBOARD-INTEGRATION-01C-C1).
 *   - GARDEROBEN — a compact per-dressing-room allocation list.
 *   - NICHT ZUGETEILT — a restrained, compact list of eligible activities
 *     that could not be mapped to a configured pitch. Only rendered when
 *     non-empty; never a warning banner.
 *
 * INFOBOARD-INTEGRATION-01C-C1 (layout correction to the accepted Screen 2
 * facility integration):
 *   - The standalone weather panel and the sponsor section/right-side
 *     column have been removed from Screen 2. FC Allschwil has no sponsors
 *     to display; weather now renders compactly in the header instead of
 *     as a large content-area card. This does not change facility mapping,
 *     publication logic, the 4-hour horizon, active-plan resolution, or
 *     theme architecture.
 *   - The header's reserved Alexa-integration zone is preserved exactly —
 *     weather is placed with the time/date status group, never inside the
 *     Alexa-reserved region.
 *
 * Invariants:
 *   - Pure presentational server component — no "use client", no effects,
 *     no timers, no fetch, no browser storage.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone always taken from feed.tenant.timezone.
 *   - No new Date() without argument; no implicit timezone.
 *   - null / undefined values are never rendered as strings.
 *   - No scrolling — content must fit within 100dvh.
 *   - DARK/LIGHT themes are presentation only (data-theme attribute + CSS
 *     custom properties) — never affect feed content or layout structure.
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
} from "lucide-react";
import type {
  InfoboardScreen2Feed,
  PitchOccupancy,
  PitchOccupancyState,
  PitchEventSummary,
  DressingRoomOccupancy,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type { WeatherResult } from "@/lib/weather/weather-types";
import {
  DEFAULT_INFOBOARD_DISPLAY_THEME,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import styles from "./InfoboardScreen2.module.css";

// ── Public component props ────────────────────────────────────────────────────

export type InfoboardScreen2Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen2Props = {
  feed: InfoboardScreen2Feed;
  branding?: InfoboardScreen2Branding;
  /**
   * Current weather for the facility location. Rendered compactly in the
   * header next to the time/date block (INFOBOARD-INTEGRATION-01C-C1).
   * When absent or unavailable, renders a compact "WETTER N/A" fallback.
   */
  weather?: WeatherResult | null;
  /**
   * Current moment as a UTC ISO-8601 string.
   * When absent, the clock display falls back to feed.displayDate.
   */
  currentTimeIso?: string | null;
  /**
   * Display theme (INFOBOARD-INTEGRATION-01B/01C). Defaults to "DARK" — the
   * existing premium stadium theme — when omitted, so every existing caller
   * (previews, tests) is unaffected. Presentation only: never changes feed
   * content, layout, or content hierarchy — only CSS custom-property values
   * via the rendered `data-theme` attribute. Reuses the same
   * Tenant.infoboardDisplayTheme → resolver pipeline as Screen 1.
   */
  theme?: InfoboardDisplayTheme;
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

// ── Pitch event block (JETZT / DANACH) ────────────────────────────────────────

type PitchEventBlockProps = {
  event: PitchEventSummary;
  temporal: "current" | "next";
  timeZone: string;
};

function PitchEventBlock({ event, temporal, timeZone }: PitchEventBlockProps): ReactElement {
  const label = temporal === "current" ? "JETZT" : "DANACH";
  return (
    <div
      className={
        temporal === "current" ? styles.pitchCardEvent : styles.pitchCardNextEvent
      }
      data-testid={temporal === "current" ? "pitch-card-event" : "pitch-card-next-event"}
    >
      <div className={styles.pitchCardEventHeader}>
        <span
          className={styles.pitchCardTemporalLabel}
          data-status={temporal}
          data-testid={`pitch-card-temporal-${temporal}`}
        >
          {label}
        </span>
        <span className={styles.pitchCardEventTime}>
          {formatTime(event.startAt, timeZone)}
          {event.endAt !== null && (
            <span className={styles.pitchCardEventEndTime}>
              {" "}–{formatTime(event.endAt, timeZone)}
            </span>
          )}
        </span>
      </div>
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
    </div>
  );
}

// ── Pitch card ────────────────────────────────────────────────────────────────

type PitchCardProps = {
  pitch: PitchOccupancy;
  timeZone: string;
};

function PitchCard({ pitch, timeZone }: PitchCardProps): ReactElement {
  const state = pitch.state;
  const primaryEvent = pitch.currentEvent ?? pitch.nextEvent;
  const stateKey = pitchStateKey(state);
  const eventKey = primaryEvent ? eventTypeKey(primaryEvent.type) : null;
  const isFree = pitch.currentEvent === null && pitch.nextEvent === null;

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

      {pitch.currentEvent !== null && (
        <PitchEventBlock event={pitch.currentEvent} temporal="current" timeZone={timeZone} />
      )}
      {pitch.nextEvent !== null && (
        <PitchEventBlock event={pitch.nextEvent} temporal="next" timeZone={timeZone} />
      )}
      {isFree && (
        <div className={styles.pitchCardFree} data-testid="pitch-card-free">
          <span className={styles.pitchCardFreeLine}>FREI</span>
        </div>
      )}
    </div>
  );
}

// ── Dressing-room section ─────────────────────────────────────────────────────

type DressingRoomRowProps = {
  room: DressingRoomOccupancy;
};

function DressingRoomRow({ room }: DressingRoomRowProps): ReactElement {
  const stateKey =
    room.state === "OCCUPIED_NOW" ? "occupied" : room.state === "UPCOMING" ? "upcoming" : "free";

  return (
    <div
      className={styles.dressingRoomRow}
      data-testid="dressing-room-row"
      data-state={stateKey}
    >
      <span className={styles.dressingRoomCode} data-testid="dressing-room-code">
        {room.displayLabel}
      </span>
      {room.current !== null ? (
        <span className={styles.dressingRoomTeam} data-testid="dressing-room-occupant">
          {room.current.assignedTo ?? "BELEGT"}
        </span>
      ) : room.next !== null ? (
        <span className={styles.dressingRoomNext} data-testid="dressing-room-next">
          DANACH: {room.next.assignedTo ?? "—"}
        </span>
      ) : (
        <span className={styles.dressingRoomFreeLabel} data-testid="dressing-room-free">
          FREI
        </span>
      )}
    </div>
  );
}

type DressingRoomSectionProps = {
  rooms: readonly DressingRoomOccupancy[];
};

function DressingRoomSection({ rooms }: DressingRoomSectionProps): ReactElement | null {
  if (rooms.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.dressingRoomSection}
      data-testid="dressing-room-section"
      aria-label="Garderoben"
    >
      <div className={styles.dressingRoomHeader}>
        <span className={styles.dressingRoomSectionTitle}>GARDEROBEN</span>
      </div>
      <div className={styles.dressingRoomList} data-testid="dressing-room-list">
        {rooms.map((room) => (
          <DressingRoomRow key={room.code} room={room} />
        ))}
      </div>
    </section>
  );
}

// ── Unallocated section ────────────────────────────────────────────────────────

type UnallocatedSectionProps = {
  activities: readonly PitchEventSummary[];
  timeZone: string;
};

/**
 * Compact, restrained list of eligible current/upcoming activities that
 * could not be mapped to a configured pitch. Only rendered when non-empty
 * — never a warning banner, never shown to "fill space".
 */
function UnallocatedSection({ activities, timeZone }: UnallocatedSectionProps): ReactElement | null {
  if (activities.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.unallocatedSection}
      data-testid="unallocated-section"
      aria-label="Nicht zugeteilte Aktivitäten"
    >
      <span className={styles.unallocatedTitle}>NICHT ZUGETEILT</span>
      <ul className={styles.unallocatedList} data-testid="unallocated-list">
        {activities.map((activity) => (
          <li key={activity.eventId} className={styles.unallocatedItem} data-testid="unallocated-item">
            <span className={styles.unallocatedTime}>{formatTime(activity.startAt, timeZone)}</span>
            <span className={styles.unallocatedType}>{eventTypeLabel(activity.type)}</span>
            <span className={styles.unallocatedName}>
              {activity.teamDisplayName ?? activity.displayTitle}
              {activity.opponentDisplayName !== null && ` – ${activity.opponentDisplayName}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Header weather (compact — INFOBOARD-INTEGRATION-01C-C1) ──────────────────

type HeaderWeatherProps = {
  weather: WeatherResult | null | undefined;
};

/**
 * Compact weather indicator for the Screen 2 header, placed next to the
 * time/date block. Replaces the former standalone weather content-area
 * panel. Intentionally minimal — icon, temperature, short condition text,
 * and the MeteoSwiss attribution required by the OGD terms. No wind, no
 * secondary panel; never a weather dashboard.
 */
function HeaderWeather({ weather }: HeaderWeatherProps): ReactElement {
  const isAvailable = weather?.isAvailable === true;

  if (!isAvailable || !weather) {
    return (
      <div
        className={styles.headerWeather}
        data-testid="header-weather"
        aria-label="Wetter"
      >
        <span
          className={styles.headerWeatherUnavailable}
          data-testid="header-weather-unavailable"
        >
          WETTER N/A
        </span>
      </div>
    );
  }

  const IconComponent = getWeatherIcon(weather.conditionCode);

  return (
    <div
      className={styles.headerWeather}
      data-testid="header-weather"
      aria-label="Wetter"
    >
      <IconComponent size={26} strokeWidth={1.5} aria-hidden={true} />
      <span className={styles.headerWeatherTemp} data-testid="header-weather-temperature">
        {weather.temperatureC}
        <span className={styles.headerWeatherTempUnit}>&thinsp;°C</span>
      </span>
      <div className={styles.headerWeatherMeta}>
        <span
          className={styles.headerWeatherCondition}
          data-testid="header-weather-condition"
        >
          {weather.conditionLabel}
        </span>
        {/* Attribution required by MeteoSwiss OGD terms: "Source: MeteoSwiss" */}
        <span
          className={styles.headerWeatherAttribution}
          data-testid="header-weather-attribution"
        >
          Quelle: MeteoSwiss
        </span>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen2({
  feed,
  branding,
  weather,
  currentTimeIso,
  theme = DEFAULT_INFOBOARD_DISPLAY_THEME,
}: InfoboardScreen2Props): ReactElement {
  const { tenant, pitches, dressingRooms, unallocated } = feed;
  const timeZone = tenant.timezone;
  const themeAttr = theme.toLowerCase();

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  const staticDateFallback = formatDisplayDate(feed.displayDate);

  const hasPitches = pitches.length > 0;

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen2-root"
      data-theme={themeAttr}
    >
      {/* ── Shared kiosk header (canonical — identical to Screen 1) ─────── */}
      <KioskShellHeader
        clubLogoSrc={clubLogoSrc}
        clubName={tenant.name}
        facilityLine={feed.facilityName ?? undefined}
        initialTimeIso={currentTimeIso}
        timezone={timeZone}
        showTime={true}
        showDate={true}
        staticDateFallback={staticDateFallback}
        subtitle="ANLAGENÜBERSICHT"
        subtitleEnabled={true}
        rightContent={<HeaderWeather weather={weather} />}
      />

      {/* ── Main content: facility overview (full width) ───────────────────
          The sponsor/weather sidebar has been removed (INFOBOARD-INTEGRATION-
          01C-C1) — the facility column now uses the full content width. */}
      <main className={styles.main}>
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

          <DressingRoomSection rooms={dressingRooms} />
          <UnallocatedSection activities={unallocated} timeZone={timeZone} />
        </div>
      </main>

      {/* ── Shared kiosk footer (canonical — identical to Screen 1) ─────── */}
      <KioskShellFooter
        productLogoSrc={productLogoSrc}
        leftLabel={feed.facilityName ?? undefined}
      />
    </div>
  );
}
