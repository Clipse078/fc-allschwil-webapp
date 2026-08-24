/**
 * lib/infoboard/screen1-logo-settings.ts
 *
 * Screen 1 Match/Tournament logo presentation presets.
 * Stable enum model — no arbitrary pixel sizing exposed to administrators.
 */

export const INFOBOARD_LOGO_SIZES = ["SMALL", "MEDIUM", "LARGE", "XLARGE"] as const;

export type InfoboardLogoSize = (typeof INFOBOARD_LOGO_SIZES)[number];

export const DEFAULT_INFOBOARD_LOGO_SIZE: InfoboardLogoSize = "MEDIUM";

/** German labels for admin UI select options. */
export const LOGO_SIZE_LABELS: Record<InfoboardLogoSize, string> = {
  SMALL: "Klein",
  MEDIUM: "Mittel",
  LARGE: "Gross",
  XLARGE: "Extra gross",
};

/**
 * Match logo CSS clamp values per preset.
 * MEDIUM reproduces the accepted baseline (--ib-match-logo-size).
 */
export const MATCH_LOGO_SIZE_CSS: Record<InfoboardLogoSize, string> = {
  SMALL: "clamp(1.6rem, 1.85vw, 2rem)",
  MEDIUM: "clamp(2rem, 2.35vw, 2.375rem)",
  LARGE: "clamp(2.5rem, 3vw, 3rem)",
  XLARGE: "clamp(3rem, 3.65vw, 3.5rem)",
};

/**
 * Tournament logo CSS clamp values per preset.
 * MEDIUM reproduces the accepted baseline (--ib-tournament-logo-size).
 */
export const TOURNAMENT_LOGO_SIZE_CSS: Record<InfoboardLogoSize, string> = {
  SMALL: "clamp(1.8rem, 2.2vw, 2.5rem)",
  MEDIUM: "clamp(2.25rem, 2.8vw, 3.4375rem)",
  LARGE: "clamp(2.9rem, 3.5vw, 4rem)",
  XLARGE: "clamp(3.4rem, 4.1vw, 4.75rem)",
};

export type Screen1LogoPresentationConfig = {
  readonly matchShowLogos: boolean;
  readonly matchLogoSize: InfoboardLogoSize;
  readonly tournamentShowLogos: boolean;
  readonly tournamentLogoSize: InfoboardLogoSize;
};

export const DEFAULT_SCREEN1_LOGO_PRESENTATION: Screen1LogoPresentationConfig = {
  matchShowLogos: true,
  matchLogoSize: DEFAULT_INFOBOARD_LOGO_SIZE,
  tournamentShowLogos: true,
  tournamentLogoSize: DEFAULT_INFOBOARD_LOGO_SIZE,
};

export function isInfoboardLogoSize(value: string | null | undefined): value is InfoboardLogoSize {
  return value != null && (INFOBOARD_LOGO_SIZES as readonly string[]).includes(value);
}

export function resolveInfoboardLogoSize(
  value: string | null | undefined,
): InfoboardLogoSize {
  return isInfoboardLogoSize(value) ? value : DEFAULT_INFOBOARD_LOGO_SIZE;
}
