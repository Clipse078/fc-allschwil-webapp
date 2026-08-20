/**
 * components/infoboard/screen2/InfoboardScreen2.tsx
 *
 * Infoboard Screen 2 — FACILITY ORIENTATION OVERVIEW.
 *
 * Purpose:
 *   "Where are the facilities, and what is the current status?"
 *   Orientation-first design: the facility name and spatial position dominate.
 *   Status is secondary and simplified to four values: FREI / TRAINING / MATCH
 *   / TURNIER. No team names, no times, no competition labels.
 *
 * Layout:
 *   - HEADER — shared kiosk header (club branding, clock, weather).
 *   - FACILITY DIAGRAM — large spatial regions per facility/pitch.
 *     Each region shows the facility name prominently. Status fills the area.
 *     Feld A/B halves are shown side by side within the same pitch footprint
 *     when the facility group resolver produces HALF_PITCH entries.
 *   - GARDEROBEN — compact per-dressing-room allocation list.
 *   - FOOTER — shared kiosk footer / announcement marquee.
 *
 * INFOBOARD-FINAL-C (VISUAL ACCEPTANCE CORRECTIONS V2):
 *   - Applies groupFacilityPitches() to respect the FULL/HALF_PITCH hierarchy.
 *   - Simplified status: only FREI / TRAINING / MATCH / TURNIER are shown.
 *   - Event metadata (team names, opponent, times) is not displayed.
 *   - HALF_PITCH entries sharing a facilityId are grouped as halves of one
 *     pitch, displayed side by side within a shared pitch-region boundary.
 *   - The facility diagram uses the full content canvas.
 *   - The "ANLAGEPLAN" floating label has been removed (see AnlageplanMapScene).
 *
 * Invariants:
 *   - Pure presentational server component — no "use client", no effects.
 *   - No Prisma imports, no DB access.
 *   - Tenant timezone always taken from feed.tenant.timezone.
 *   - No new Date() without argument; no implicit timezone.
 *   - null / undefined values are never rendered as strings.
 *   - No scrolling — content must fit within 100dvh.
 *   - DARK/LIGHT themes are presentation only (data-theme + CSS custom props).
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
  DressingRoomOccupancy,
  PublishingEventType,
} from "@/lib/publishing/event-types";
import type { WeatherResult } from "@/lib/weather/weather-types";
import {
  DEFAULT_INFOBOARD_DISPLAY_THEME,
  type InfoboardDisplayTheme,
} from "@/lib/publishing/infoboard/display-theme";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import type { SharedBoardShellConfig } from "@/lib/infoboard/board-config";
import styles from "./InfoboardScreen2.module.css";

// ── Public component props ────────────────────────────────────────────────────

export type InfoboardScreen2Branding = {
  clubLogoSrc?: string | null;
  productLogoSrc?: string | null;
};

export type InfoboardScreen2Props = {
  feed: InfoboardScreen2Feed;
  branding?: InfoboardScreen2Branding;
  weather?: WeatherResult | null;
  currentTimeIso?: string | null;
  theme?: InfoboardDisplayTheme;
  shellConfig?: SharedBoardShellConfig | null;
};

// ── Simplified status ─────────────────────────────────────────────────────────
//
// Screen 2 shows only four status values:
//   FREI     — pitch is currently free (no active event).
//   TRAINING — pitch has an active training session.
//   MATCH    — pitch has an active match.
//   TURNIER  — pitch has an active tournament.
//
// UPCOMING / UNKNOWN states map to FREI because the pitch is physically free.
// No team names, no opponent names, no times are shown.

type SimplifiedStatus = "FREI" | "TRAINING" | "MATCH" | "TURNIER";

function resolveSimplifiedStatus(pitch: PitchOccupancy): SimplifiedStatus {
  const event = pitch.currentEvent;
  if (!event) return "FREI";
  switch (event.type) {
    case "MATCH":      return "MATCH";
    case "TRAINING":   return "TRAINING";
    case "TOURNAMENT": return "TURNIER";
    default:           return "FREI";
  }
}

function simplifiedStatusKey(status: SimplifiedStatus): string {
  return status.toLowerCase();
}

function eventTypeKey(type: PublishingEventType): string {
  switch (type) {
    case "MATCH":      return "match";
    case "TRAINING":   return "training";
    case "TOURNAMENT": return "tournament";
    default:           return "other";
  }
}

// ── Facility grouping ─────────────────────────────────────────────────────────
//
// After groupFacilityPitches(), visible pitches may contain:
//   - FULL_PITCH entries (shown as a single full region)
//   - HALF_PITCH entries (two per facility — shown as side-by-side halves)
//
// Group by facilityId so HALF_PITCH pairs are rendered together in one region.

type FacilityRegion = {
  facilityId: string;
  /** Facility/pitch display name — from facilityName or displayLabel. */
  facilityName: string;
  pitches: PitchOccupancy[];
};

/**
 * Groups visible pitches into FacilityRegions for the spatial diagram.
 *
 * FULL_PITCH pitches each become their own region, even when multiple
 * FULL_PITCH resources share the same facilityId (common in basic setups
 * where STADION, KR1, KR2, KR3 all belong to one administrative facility).
 *
 * HALF_PITCH pitches are grouped by facilityId so that Feld A and Feld B
 * appear side-by-side within a shared pitch region. groupFacilityPitches()
 * guarantees that HALF_PITCH entries only appear when relevant (one half is
 * occupied); the FULL_PITCH representation is suppressed in that case.
 */
function groupByFacility(pitches: readonly PitchOccupancy[]): FacilityRegion[] {
  const result: FacilityRegion[] = [];
  // Track HALF_PITCH groups by facilityId to accumulate halves in order
  const halfGroups = new Map<string, FacilityRegion>();

  for (const pitch of pitches) {
    if (pitch.resourceType === "HALF_PITCH") {
      // Group with other halves sharing the same facilityId
      if (!halfGroups.has(pitch.facilityId)) {
        const region: FacilityRegion = {
          facilityId: pitch.facilityId,
          facilityName: pitch.facilityName ?? pitch.displayLabel,
          pitches: [],
        };
        halfGroups.set(pitch.facilityId, region);
        result.push(region);
      }
      halfGroups.get(pitch.facilityId)!.pitches.push(pitch);
    } else {
      // FULL_PITCH: always its own region regardless of shared facilityId
      result.push({
        facilityId: `${pitch.facilityId}:${pitch.code}`,
        facilityName: pitch.displayLabel,
        pitches: [pitch],
      });
    }
  }

  return result;
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatDisplayDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

// ── Header weather (compact) ──────────────────────────────────────────────────

type HeaderWeatherProps = {
  weather: WeatherResult | null | undefined;
};

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

// ── Single pitch region (FULL_PITCH or one HALF_PITCH) ───────────────────────

type PitchRegionProps = {
  pitch: PitchOccupancy;
  /** Half label shown above the facility name for HALF_PITCH (A or B). */
  halfLabel?: string | null;
};

function PitchRegion({ pitch, halfLabel }: PitchRegionProps): ReactElement {
  const status = resolveSimplifiedStatus(pitch);
  const statusKey = simplifiedStatusKey(status);
  const stateKey = pitch.currentEvent !== null ? "occupied" : "free";
  const eventKey = pitch.currentEvent ? eventTypeKey(pitch.currentEvent.type) : null;
  const isFree = status === "FREI";

  return (
    <div
      className={styles.pitchCard}
      data-testid="pitch-card"
      data-state={stateKey}
      data-event-type={eventKey ?? undefined}
      data-simplified-status={statusKey}
    >
      {halfLabel && (
        <span className={styles.pitchHalfLabel} data-testid="pitch-half-label">
          {halfLabel}
        </span>
      )}

      <div
        className={styles.pitchCardName}
        data-testid="pitch-card-name"
      >
        {pitch.displayLabel}
      </div>

      <div
        className={`${styles.pitchCardStatus} ${styles[`pitchStatus_${statusKey}`] ?? ""}`}
        data-state={stateKey}
        data-simplified-status={statusKey}
        data-testid="pitch-card-status"
      >
        {status}
      </div>

      {isFree && (
        <div className={styles.pitchCardFree} data-testid="pitch-card-free">
          <span className={styles.pitchCardFreeLine}>FREI</span>
        </div>
      )}
    </div>
  );
}

// ── Facility region (groups FULL_PITCH or pairs of HALF_PITCH) ────────────────

type FacilityRegionProps = {
  region: FacilityRegion;
};

function FacilityRegionBlock({ region }: FacilityRegionProps): ReactElement {
  const isHalfPair =
    region.pitches.length === 2 &&
    region.pitches.every((p) => p.resourceType === "HALF_PITCH");

  if (isHalfPair) {
    const [halfA, halfB] = region.pitches;
    const labelA = halfA.displayLabel;
    const labelB = halfB.displayLabel;

    return (
      <div
        className={styles.pitchHalfPair}
        data-testid="pitch-half-pair"
        data-facility-id={region.facilityId}
      >
        {/* Shared facility name across the half pair */}
        <div className={styles.pitchHalfPairName} data-testid="pitch-facility-name">
          {region.facilityName}
        </div>

        <div className={styles.pitchHalfPairGrid}>
          <PitchRegion pitch={halfA} halfLabel={labelA} />
          <PitchRegion pitch={halfB} halfLabel={labelB} />
        </div>
      </div>
    );
  }

  // Single FULL_PITCH (most common case)
  const pitch = region.pitches[0];
  return <PitchRegion pitch={pitch} />;
}

// ── Pitch grid ────────────────────────────────────────────────────────────────

type FacilityDiagramProps = {
  regions: FacilityRegion[];
};

function FacilityDiagram({ regions }: FacilityDiagramProps): ReactElement {
  if (regions.length === 0) {
    return (
      <div className={styles.pitchGridEmpty} data-testid="pitch-grid-empty">
        <span className={styles.pitchGridEmptyText}>
          KEINE FELDDATEN VERFÜGBAR
        </span>
      </div>
    );
  }

  return (
    <div
      className={styles.pitchGrid}
      data-testid="pitch-grid"
      data-count={regions.length}
    >
      {regions.map((region) => (
        <FacilityRegionBlock key={region.facilityId} region={region} />
      ))}
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

// ── Root component ────────────────────────────────────────────────────────────

export function InfoboardScreen2({
  feed,
  branding,
  weather,
  currentTimeIso,
  theme = DEFAULT_INFOBOARD_DISPLAY_THEME,
  shellConfig,
}: InfoboardScreen2Props): ReactElement {
  const { tenant, pitches, dressingRooms } = feed;
  const timeZone = tenant.timezone;
  const themeAttr = theme.toLowerCase();

  const clubLogoSrc = branding?.clubLogoSrc ?? null;
  const productLogoSrc = branding?.productLogoSrc ?? null;

  const staticDateFallback = formatDisplayDate(feed.displayDate);

  // ── Apply canonical FULL_PITCH / HALF_PITCH hierarchy ────────────────────
  // groupFacilityPitches() is the single canonical resolver. Do not duplicate.
  const { visiblePitches } = groupFacilityPitches(pitches);

  // ── Group visible pitches by facility for the spatial diagram ─────────────
  const facilityRegions = groupByFacility(visiblePitches);

  // ── Resolve shared shell settings (with backward-compat defaults) ────────
  const subtitleEnabled = shellConfig != null
    ? shellConfig.headerSubtitleEnabled
    : true;
  const subtitleText = shellConfig != null
    ? (shellConfig.headerSubtitleText ?? "ANLAGENÜBERSICHT")
    : "ANLAGENÜBERSICHT";
  const showTime = shellConfig?.headerShowTime ?? true;
  const showDate = shellConfig?.headerShowDate ?? true;

  const announcementEnabled =
    shellConfig != null &&
    shellConfig.announcementEnabled &&
    typeof shellConfig.announcementText === "string" &&
    shellConfig.announcementText.trim().length > 0;

  return (
    <div
      className={styles.root}
      data-testid="infoboard-screen2-root"
      data-theme={themeAttr}
    >
      {/* ── Shared kiosk header ───────────────────────────────────────────── */}
      <KioskShellHeader
        clubLogoSrc={clubLogoSrc}
        clubName={tenant.name}
        facilityLine={feed.facilityName ?? undefined}
        initialTimeIso={currentTimeIso}
        timezone={timeZone}
        showTime={showTime}
        showDate={showDate}
        staticDateFallback={staticDateFallback}
        subtitle={subtitleText}
        subtitleEnabled={subtitleEnabled}
        rightContent={<HeaderWeather weather={weather} />}
      />

      {/* ── Main content: spatial facility diagram ────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.facilityColumn}>

          {/* Facility orientation diagram — orientation-first, status-secondary */}
          <section
            className={styles.facilitySection}
            aria-label="Feldbelegung"
            data-testid="facility-overview"
          >
            <FacilityDiagram regions={facilityRegions} />
          </section>

          <DressingRoomSection rooms={dressingRooms} />
        </div>
      </main>

      {/* ── Shared kiosk footer ───────────────────────────────────────────── */}
      <KioskShellFooter
        productLogoSrc={productLogoSrc}
        leftLabel={announcementEnabled ? undefined : (feed.facilityName ?? undefined)}
        announcement={announcementEnabled && shellConfig
          ? {
              enabled: true,
              text: shellConfig.announcementText,
              backgroundColor: shellConfig.announcementBgColor ?? null,
              textColor: shellConfig.announcementTextColor ?? null,
            }
          : undefined}
      />
    </div>
  );
}
