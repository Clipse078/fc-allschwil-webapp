/**
 * lib/infoboard/kiosk-shell-sizing.ts
 *
 * Canonical physical-TV shell geometry for the shared 1920×1080 kiosk design
 * canvas. Values match Screen 2's accepted full-HD appearance (7.5vh, 2vw, …
 * evaluated at 1920×1080) and are expressed in fixed px so they stay correct
 * inside KioskViewportScaler — vh/vw would resolve against the browser
 * viewport instead of the logical canvas and shrink the Screen 1 shell.
 */

import {
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";

/** Canonical 16:9 physical-TV design canvas. */
export const KIOSK_SHELL_CANVAS_WIDTH = KIOSK_LOGICAL_WIDTH;
export const KIOSK_SHELL_CANVAS_HEIGHT = KIOSK_LOGICAL_HEIGHT;

/** Shared header row height (excludes orange border). */
export const KIOSK_SHELL_HEADER_HEIGHT_PX = 81;

/** Orange divider below the header. */
export const KIOSK_SHELL_HEADER_BORDER_PX = 3;

/** Welcome / subtitle strip height. */
export const KIOSK_SHELL_SUBTITLE_HEIGHT_PX = 41;

/** Footer bar height (announcement ticker / branding). */
export const KIOSK_SHELL_FOOTER_HEIGHT_PX = 49;

/** Tenant crest height in the header. */
export const KIOSK_SHELL_CREST_HEIGHT_PX = 59;

/** Club name typography in the header. */
export const KIOSK_SHELL_CLUB_NAME_FONT_PX = 38;

/** Live clock typography in the header. */
export const KIOSK_SHELL_CLOCK_FONT_PX = 65;

/** Weekday label in the date block. */
export const KIOSK_SHELL_WEEKDAY_FONT_PX = 18;

/** Date line in the date block. */
export const KIOSK_SHELL_DATE_FONT_PX = 17;

/** Shared header weather icon (KioskShellHeader weather prop). */
export const KIOSK_SHELL_WEATHER_ICON_PX = 34;

/** Shared header weather temperature. */
export const KIOSK_SHELL_WEATHER_TEMP_FONT_PX = 40;

/** Shared header weather condition label. */
export const KIOSK_SHELL_WEATHER_CONDITION_FONT_PX = 16;

/** Welcome / subtitle strip typography. */
export const KIOSK_SHELL_SUBTITLE_FONT_PX = 19;

/** Footer ticker / left-label typography. */
export const KIOSK_SHELL_FOOTER_TICKER_FONT_PX = 16;

/** SportClubEvo branding max height in the footer. */
export const KIOSK_SHELL_BRANDING_HEIGHT_PX = 29;

/** SportClubEvo branding max width in the footer. */
export const KIOSK_SHELL_BRANDING_WIDTH_PX = 220;

/** Horizontal padding for header, subtitle, and footer. */
export const KIOSK_SHELL_PADDING_X_PX = 38;

/** Gap between header right-side zones. */
export const KIOSK_SHELL_HEADER_ZONE_PADDING_X_PX = 28;

/** CSS custom properties applied on the shared shell wrapper. */
export const KIOSK_SHELL_CSS_VARS = {
  "--kiosk-shell-canvas-width": `${KIOSK_SHELL_CANVAS_WIDTH}px`,
  "--kiosk-shell-canvas-height": `${KIOSK_SHELL_CANVAS_HEIGHT}px`,
  "--kiosk-shell-header-height": `${KIOSK_SHELL_HEADER_HEIGHT_PX}px`,
  "--kiosk-shell-header-border": `${KIOSK_SHELL_HEADER_BORDER_PX}px`,
  "--kiosk-shell-subtitle-height": `${KIOSK_SHELL_SUBTITLE_HEIGHT_PX}px`,
  "--kiosk-shell-footer-height": `${KIOSK_SHELL_FOOTER_HEIGHT_PX}px`,
  "--kiosk-shell-crest-height": `${KIOSK_SHELL_CREST_HEIGHT_PX}px`,
  "--kiosk-shell-club-name-font": `${KIOSK_SHELL_CLUB_NAME_FONT_PX}px`,
  "--kiosk-shell-clock-font": `${KIOSK_SHELL_CLOCK_FONT_PX}px`,
  "--kiosk-shell-weekday-font": `${KIOSK_SHELL_WEEKDAY_FONT_PX}px`,
  "--kiosk-shell-date-font": `${KIOSK_SHELL_DATE_FONT_PX}px`,
  "--kiosk-shell-weather-icon": `${KIOSK_SHELL_WEATHER_ICON_PX}px`,
  "--kiosk-shell-weather-temp-font": `${KIOSK_SHELL_WEATHER_TEMP_FONT_PX}px`,
  "--kiosk-shell-weather-condition-font": `${KIOSK_SHELL_WEATHER_CONDITION_FONT_PX}px`,
  "--kiosk-shell-subtitle-font": `${KIOSK_SHELL_SUBTITLE_FONT_PX}px`,
  "--kiosk-shell-footer-ticker-font": `${KIOSK_SHELL_FOOTER_TICKER_FONT_PX}px`,
  "--kiosk-shell-branding-height": `${KIOSK_SHELL_BRANDING_HEIGHT_PX}px`,
  "--kiosk-shell-branding-width": `${KIOSK_SHELL_BRANDING_WIDTH_PX}px`,
  "--kiosk-shell-padding-x": `${KIOSK_SHELL_PADDING_X_PX}px`,
  "--kiosk-shell-header-zone-padding-x": `${KIOSK_SHELL_HEADER_ZONE_PADDING_X_PX}px`,
} as const satisfies Record<string, string>;

export type KioskShellMeasurementContract = {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly headerHeightPx: number;
  readonly subtitleHeightPx: number;
  readonly footerHeightPx: number;
  readonly crestHeightPx: number;
  readonly clubNameFontPx: number;
  readonly clockFontPx: number;
  readonly weekdayFontPx: number;
  readonly dateFontPx: number;
  readonly footerTickerFontPx: number;
  readonly brandingHeightPx: number;
};

/** Inspectable measurement contract for docs, tests, and acceptance. */
export const KIOSK_SHELL_MEASUREMENT_CONTRACT: KioskShellMeasurementContract = {
  canvasWidth: KIOSK_SHELL_CANVAS_WIDTH,
  canvasHeight: KIOSK_SHELL_CANVAS_HEIGHT,
  headerHeightPx: KIOSK_SHELL_HEADER_HEIGHT_PX,
  subtitleHeightPx: KIOSK_SHELL_SUBTITLE_HEIGHT_PX,
  footerHeightPx: KIOSK_SHELL_FOOTER_HEIGHT_PX,
  crestHeightPx: KIOSK_SHELL_CREST_HEIGHT_PX,
  clubNameFontPx: KIOSK_SHELL_CLUB_NAME_FONT_PX,
  clockFontPx: KIOSK_SHELL_CLOCK_FONT_PX,
  weekdayFontPx: KIOSK_SHELL_WEEKDAY_FONT_PX,
  dateFontPx: KIOSK_SHELL_DATE_FONT_PX,
  footerTickerFontPx: KIOSK_SHELL_FOOTER_TICKER_FONT_PX,
  brandingHeightPx: KIOSK_SHELL_BRANDING_HEIGHT_PX,
};
