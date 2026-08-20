/**
 * components/infoboard/shared/KioskShellHeader.tsx
 *
 * Canonical shared kiosk header for all public Infoboards.
 *
 * Physical-TV information architecture:
 *
 *   CLUB | CLOCK / DATE | WEATHER | ALEXA SAFE ZONE
 *
 * The final Alexa zone is permanently empty and reserves approximately
 * 10% of the viewport for the external Fully Kiosk / Alexa overlay.
 *
 * Weather is supporting information and never occupies the Alexa zone.
 *
 * Invariants:
 *   - Pure presentational component: no fetch, DB or implicit time.
 *   - Existing header height is preserved.
 *   - LiveClockScreen1 remains the canonical kiosk clock.
 *   - Weather is provider-neutral WeatherResult data.
 *   - Unavailable weather is silently omitted.
 *   - MeteoSwiss attribution is rendered whenever weather is shown.
 */

import type { ReactElement, ReactNode } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import { resolveWeatherVisual } from "@/components/infoboard/shared/weatherVisual";

import { LiveClockScreen1 } from "@/components/infoboard/screen1/LiveClockScreen1";
import type { WeatherResult } from "@/lib/weather/weather-types";

export type KioskShellHeaderProps = {
  clubLogoSrc?: string | null;
  clubName: string;
  facilityLine?: string | null;
  subtitle?: string | null;
  subtitleEnabled?: boolean;
  initialTimeIso?: string | null;
  timezone: string;
  showTime?: boolean;
  showDate?: boolean;
  staticDateFallback?: string | null;

  /**
   * Canonical weather input for every Infoboard.
   * Unavailable weather renders no placeholder.
   */
  weather?: WeatherResult | null;

  /**
   * Backward-compatible weather/right presentation slot.
   *
   * IMPORTANT:
   * This is rendered in the WEATHER zone, never the Alexa safe zone.
   * New callers should prefer the `weather` prop.
   */
  rightContent?: ReactNode;
};

const HEADER_BG = "#0A1828";
const HEADER_BORDER = "3px solid #e87722";
const SUBTITLE_BORDER = "1px solid rgba(99, 135, 175, 0.16)";
const MUTED_TEXT = "#6E87A0";

function SharedWeather({
  weather,
}: {
  weather: WeatherResult;
}): ReactElement | null {
  if (weather.isAvailable !== true) {
    return null;
  }

  const code = weather.conditionCode;

  const weatherVisual = resolveWeatherVisual(code);

  const Icon =
    weatherVisual.iconFamily === "sun"
      ? Sun
      : weatherVisual.iconFamily === "cloud-sun"
        ? CloudSun
        : weatherVisual.iconFamily === "cloud-rain"
          ? CloudRain
          : weatherVisual.iconFamily === "snow"
            ? CloudSnow
            : weatherVisual.iconFamily === "fog"
              ? CloudFog
              : weatherVisual.iconFamily === "storm"
                ? CloudLightning
                : Cloud;

  const iconColor = weatherVisual.color;
  const temperature = Math.round(weather.temperatureC);

  return (
    <div
      data-testid="header-weather"
      aria-label="Wetter"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto minmax(0, 1fr)",
        alignItems: "center",
        columnGap: "clamp(8px, 0.75vw, 14px)",
        minWidth: "max-content",
        width: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <Icon
        aria-hidden="true"
        size={34}
        strokeWidth={1.6}
        style={{
          color: iconColor,
          flexShrink: 0,
        }}
      />

      <span
        data-testid="header-weather-temperature"
        style={{
          fontSize: "clamp(1.5rem, 2.1vw, 2.5rem)",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
          letterSpacing: "0.01em",
        }}
      >
        {temperature}°
      </span>

      <span
        data-testid="header-weather-condition"
        style={{
          fontSize: "clamp(0.68rem, 0.82vw, 0.95rem)",
          fontWeight: 500,
          color: "rgba(255,255,255,0.74)",
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {weather.conditionLabel}
      </span>
    </div>
  );
}

export function KioskShellHeader({
  clubLogoSrc,
  clubName,
  facilityLine,
  subtitle,
  subtitleEnabled = true,
  initialTimeIso,
  timezone,
  showTime = true,
  showDate = true,
  staticDateFallback,
  weather,
  rightContent,
}: KioskShellHeaderProps): ReactElement {
  const showSubtitle =
    subtitleEnabled === true &&
    subtitle != null &&
    subtitle.length > 0;

  const weatherContent =
    weather != null
      ? <SharedWeather weather={weather} />
      : rightContent ?? null;

  return (
    <div data-testid="kiosk-shell-header" style={{ flexShrink: 0 }}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) auto auto clamp(220px, 22vw, 360px) 10vw",
          alignItems: "center",

          paddingLeft: "clamp(12px, 2vw, 32px)",
          paddingRight: 0,
          background: HEADER_BG,
          borderBottom: HEADER_BORDER,

          /*
           * Physical-TV contract:
           * keep the existing header height exactly.
           */
          height: "clamp(60px, 7.5vh, 90px)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* CLUB */}
        <div
          data-testid="kiosk-header-left"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(8px, 1vw, 16px)",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {clubLogoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clubLogoSrc}
              alt={`${clubName} Wappen`}
              style={{
                height: "clamp(36px, 5.5vh, 64px)",
                width: "auto",
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                height: "clamp(36px, 5.5vh, 64px)",
                width: "clamp(36px, 5.5vh, 64px)",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(12px, 2vh, 22px)",
                fontWeight: 800,
                color: "rgba(255,255,255,0.55)",
                flexShrink: 0,
              }}
            >
              {clubName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              minWidth: 0,
            }}
          >
            <span
              data-testid="kiosk-header-club-name"
              style={{
                fontSize: "clamp(1.1rem, 2vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "#ffffff",
                lineHeight: 1,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {clubName}
            </span>

            {facilityLine && (
              <span
                style={{
                  fontSize: "clamp(0.58rem, 0.78vw, 0.88rem)",
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {facilityLine}
              </span>
            )}
          </div>
        </div>

        {/*
         * TIME + DATE — wrapped in a display:contents container so the grid
         * treats TIME and DATE as direct grid items while the wrapper element
         * remains in the DOM for tests (data-testid="header-center").
         */}
        <div data-testid="header-center" style={{ display: "contents" }}>
          {/* TIME */}
          <div
            data-testid="header-time-zone"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              height: "72%",
              paddingLeft: "clamp(18px, 1.5vw, 28px)",
              paddingRight: "clamp(18px, 1.5vw, 28px)",
              borderLeft: "1px solid rgba(148, 163, 184, 0.28)",
            }}
          >
            {initialTimeIso != null && showTime ? (
              <LiveClockScreen1
                initialTimeIso={initialTimeIso}
                timezone={timezone}
                showTime={true}
                showDate={false}
                mode="time"
              />
            ) : null}
          </div>

          {/* DATE */}
          <div
            data-testid="header-date-zone"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              height: "72%",
              paddingLeft: "clamp(18px, 1.5vw, 28px)",
              paddingRight: "clamp(18px, 1.5vw, 28px)",
              borderLeft: "1px solid rgba(148, 163, 184, 0.28)",
            }}
          >
            {initialTimeIso != null && showDate ? (
              <LiveClockScreen1
                initialTimeIso={initialTimeIso}
                timezone={timezone}
                showTime={false}
                showDate={true}
                mode="date"
              />
            ) : staticDateFallback != null && showDate ? (
              <span
                style={{
                  fontSize: "clamp(0.7rem, 0.9vw, 1rem)",
                  letterSpacing: "0.06em",
                  color: "rgba(255,255,255,0.55)",
                  whiteSpace: "nowrap",
                }}
              >
                {staticDateFallback}
              </span>
            ) : null}
          </div>
        </div>
        {/* WEATHER — never overlaps Alexa */}
        <div
          data-testid="weather-zone"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            minWidth: "clamp(220px, 22vw, 360px)",
            width: "100%",
            alignSelf: "center",
            height: "72%",
            paddingLeft: "clamp(18px, 1.5vw, 28px)",
            paddingRight: "clamp(18px, 1.5vw, 28px)",
            borderLeft: "1px solid rgba(148, 163, 184, 0.28)",
            overflow: "visible",
          }}
        >
          {weatherContent}
        </div>

        {/* ALEXA / FULLY KIOSK — permanently empty ~10% safe zone */}
        <div
          data-testid="alexa-safe-zone"
          aria-hidden="true"
          style={{
            width: "10vw",
            minWidth: "10vw",
            height: "100%",
            flexShrink: 0,
            pointerEvents: "none",
          }}
        />
      </header>

      {showSubtitle && (
        <div
          data-testid="board-title"
          style={{
            display: "flex",
            alignItems: "center",
            height: "clamp(28px, 3.8vh, 46px)",
            padding: "0 clamp(12px, 2vw, 32px)",
            borderBottom: SUBTITLE_BORDER,
            background: HEADER_BG,
            flexShrink: 0,
          }}
        >
          <span
            data-testid="board-title-text"
            style={{
              fontSize: "clamp(0.78rem, 1vw, 1.2rem)",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: MUTED_TEXT,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}