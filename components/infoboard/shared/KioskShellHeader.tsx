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
import {
  KIOSK_SHELL_CSS_VARS,
  KIOSK_SHELL_ALEXA_SAFE_ZONE_WIDTH_PX,
  KIOSK_SHELL_WEATHER_ZONE_MAX_WIDTH_PX,
  KIOSK_SHELL_WEATHER_ZONE_MIN_WIDTH_PX,
} from "@/lib/infoboard/kiosk-shell-sizing";
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
  /** Keep the simulated Preview Studio moment fixed. Defaults to live kiosk time. */
  liveClock?: boolean;

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
const SUBTITLE_BORDER = "1px solid rgba(99, 135, 175, 0.16)";
const MUTED_TEXT = "#6E87A0";

const HEADER_ZONE_BORDER = "1px solid rgba(148, 163, 184, 0.28)";
const HEADER_ZONE_HEIGHT = "72%";
const HEADER_ZONE_PADDING_X =
  KIOSK_SHELL_CSS_VARS["--kiosk-shell-header-zone-padding-x"];
const HEADER_WEATHER_MIN_WIDTH_PX = KIOSK_SHELL_WEATHER_ZONE_MIN_WIDTH_PX;
const HEADER_WEATHER_MAX_WIDTH_PX = KIOSK_SHELL_WEATHER_ZONE_MAX_WIDTH_PX;
const HEADER_ALEXA_SAFE_ZONE_WIDTH_PX = KIOSK_SHELL_ALEXA_SAFE_ZONE_WIDTH_PX;

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
        columnGap: "14px",
        minWidth: "max-content",
        width: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <Icon
        aria-hidden="true"
        size={Number.parseInt(KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-icon"], 10)}
        strokeWidth={1.6}
        style={{
          color: iconColor,
          flexShrink: 0,
        }}
      />

      <span
        data-testid="header-weather-temperature"
        style={{
          fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-temp-font"],
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
          fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-weather-condition-font"],
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
  liveClock = true,
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
    <div
      data-testid="kiosk-shell-header"
      data-kiosk-shell-contract="true"
      style={{ flexShrink: 0, ...KIOSK_SHELL_CSS_VARS }}
    >
      <header
        data-testid="kiosk-shell-header-bar"
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          boxSizing: "border-box",

          paddingLeft: KIOSK_SHELL_CSS_VARS["--kiosk-shell-padding-x"],
          paddingRight: 0,
          background: HEADER_BG,
          borderBottom: `${KIOSK_SHELL_CSS_VARS["--kiosk-shell-header-border"]} solid #e87722`,

          height: KIOSK_SHELL_CSS_VARS["--kiosk-shell-header-height"],
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
            gap: "16px",
            flex: "1 1 0",
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
                height: KIOSK_SHELL_CSS_VARS["--kiosk-shell-crest-height"],
                width: "auto",
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                height: KIOSK_SHELL_CSS_VARS["--kiosk-shell-crest-height"],
                width: KIOSK_SHELL_CSS_VARS["--kiosk-shell-crest-height"],
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
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
                fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-club-name-font"],
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
                  fontSize: "14px",
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
         * CLOCK / DATE / WEATHER / ALEXA — fixed flex cluster on the right.
         * Keeps the weather column reserved inside the 1920×1080 shell when
         * the calibrated clock/date blocks use fixed px typography.
         */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: "0 0 auto",
            minWidth: 0,
            maxWidth: "100%",
            height: "100%",
          }}
        >
          <div
            data-testid="header-center"
            style={{
              display: "flex",
              alignItems: "center",
              flex: "0 0 auto",
              height: "100%",
            }}
          >
            {/* TIME */}
            <div
              data-testid="header-time-zone"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: HEADER_ZONE_HEIGHT,
                flexShrink: 0,
                paddingLeft: HEADER_ZONE_PADDING_X,
                paddingRight: HEADER_ZONE_PADDING_X,
                borderLeft: HEADER_ZONE_BORDER,
              }}
            >
              {initialTimeIso != null && showTime ? (
                <LiveClockScreen1
                  initialTimeIso={initialTimeIso}
                  timezone={timezone}
                  showTime={true}
                  showDate={false}
                  mode="time"
                  live={liveClock}
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
                height: HEADER_ZONE_HEIGHT,
                flexShrink: 0,
                paddingLeft: HEADER_ZONE_PADDING_X,
                paddingRight: HEADER_ZONE_PADDING_X,
                borderLeft: HEADER_ZONE_BORDER,
              }}
            >
              {initialTimeIso != null && showDate ? (
                <LiveClockScreen1
                  initialTimeIso={initialTimeIso}
                  timezone={timezone}
                  showTime={false}
                  showDate={true}
                  mode="date"
                  live={liveClock}
                />
              ) : staticDateFallback != null && showDate ? (
                <span
                  style={{
                    fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-date-font"],
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
              flex: `1 0 ${HEADER_WEATHER_MIN_WIDTH_PX}px`,
              minWidth: `${HEADER_WEATHER_MIN_WIDTH_PX}px`,
              maxWidth: `${HEADER_WEATHER_MAX_WIDTH_PX}px`,
              height: HEADER_ZONE_HEIGHT,
              paddingLeft: HEADER_ZONE_PADDING_X,
              paddingRight: HEADER_ZONE_PADDING_X,
              borderLeft: HEADER_ZONE_BORDER,
              overflow: "hidden",
            }}
          >
            {weatherContent}
          </div>

          {/* ALEXA / FULLY KIOSK — permanently empty ~10% safe zone */}
          <div
            data-testid="alexa-safe-zone"
            aria-hidden="true"
            style={{
              width: `${HEADER_ALEXA_SAFE_ZONE_WIDTH_PX}px`,
              minWidth: `${HEADER_ALEXA_SAFE_ZONE_WIDTH_PX}px`,
              height: "100%",
              flexShrink: 0,
              pointerEvents: "none",
            }}
          />
        </div>
      </header>

      {showSubtitle && (
        <div
          data-testid="board-title"
          style={{
            display: "flex",
            alignItems: "center",
            height: KIOSK_SHELL_CSS_VARS["--kiosk-shell-subtitle-height"],
            padding: `0 ${KIOSK_SHELL_CSS_VARS["--kiosk-shell-padding-x"]}`,
            borderBottom: SUBTITLE_BORDER,
            background: HEADER_BG,
            flexShrink: 0,
          }}
        >
          <span
            data-testid="board-title-text"
            style={{
              fontSize: KIOSK_SHELL_CSS_VARS["--kiosk-shell-subtitle-font"],
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