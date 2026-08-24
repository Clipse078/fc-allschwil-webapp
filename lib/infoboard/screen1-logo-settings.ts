/**
 * lib/infoboard/screen1-logo-settings.ts
 *
 * Screen 1 Training/Match/Tournament presentation presets.
 * Stable enum model — no arbitrary sizing exposed to administrators.
 */

export const INFOBOARD_LOGO_SIZES = ["SMALL", "MEDIUM", "LARGE", "XLARGE"] as const;

export type InfoboardLogoSize = (typeof INFOBOARD_LOGO_SIZES)[number];

export const DEFAULT_INFOBOARD_LOGO_SIZE: InfoboardLogoSize = "MEDIUM";

export const INFOBOARD_FONT_SIZES = INFOBOARD_LOGO_SIZES;

export type InfoboardFontSize = (typeof INFOBOARD_FONT_SIZES)[number];

/** Existing typography is LARGE; Match defaults lower after physical-TV acceptance. */
export const DEFAULT_TRAINING_FONT_SIZE: InfoboardFontSize = "LARGE";
export const DEFAULT_MATCH_FONT_SIZE: InfoboardFontSize = "MEDIUM";
export const DEFAULT_TOURNAMENT_FONT_SIZE: InfoboardFontSize = "LARGE";

/** German labels for admin UI select options. */
export const LOGO_SIZE_LABELS: Record<InfoboardLogoSize, string> = {
  SMALL: "Klein",
  MEDIUM: "Mittel",
  LARGE: "Gross",
  XLARGE: "Extra gross",
};

/** German labels shared by the independent font-size selects. */
export const FONT_SIZE_LABELS: Record<InfoboardFontSize, string> = LOGO_SIZE_LABELS;

/** Training team-name clamps, including safe caps for grouped-card density. */
export const TRAINING_FONT_SIZE_CSS: Record<
  InfoboardFontSize,
  { normal: string; compact: string; dense: string }
> = {
  SMALL: {
    normal: "clamp(1.52rem, 2.28vw, 3.04rem)",
    compact: "clamp(0.874rem, 1.178vw, 1.672rem)",
    dense: "clamp(0.798rem, 1.064vw, 1.52rem)",
  },
  MEDIUM: {
    normal: "clamp(1.76rem, 2.64vw, 3.52rem)",
    compact: "clamp(1.012rem, 1.364vw, 1.936rem)",
    dense: "clamp(0.924rem, 1.232vw, 1.76rem)",
  },
  LARGE: {
    normal: "clamp(2rem, 3vw, 4rem)",
    compact: "clamp(1.15rem, 1.55vw, 2.2rem)",
    dense: "clamp(1.05rem, 1.4vw, 2rem)",
  },
  XLARGE: {
    normal: "clamp(2.24rem, 3.36vw, 4.48rem)",
    compact: "clamp(1.15rem, 1.55vw, 2.2rem)",
    dense: "clamp(1.05rem, 1.4vw, 2rem)",
  },
};

/** Match primary/opponent clamps; long-name and page-density caps apply after these. */
export const MATCH_FONT_SIZE_CSS: Record<
  InfoboardFontSize,
  { primary: string; opponent: string }
> = {
  SMALL: {
    primary: "clamp(1.4rem, 1.8vw, 2.25rem)",
    opponent: "clamp(0.77rem, 1.05vw, 1.4rem)",
  },
  MEDIUM: {
    primary: "clamp(1.65rem, 2.15vw, 2.75rem)",
    opponent: "clamp(0.935rem, 1.25vw, 1.65rem)",
  },
  LARGE: {
    primary: "clamp(2rem, 3vw, 4rem)",
    opponent: "clamp(1.1rem, 1.5vw, 2rem)",
  },
  XLARGE: {
    primary: "clamp(2.24rem, 3.36vw, 4.48rem)",
    opponent: "clamp(1.232rem, 1.68vw, 2.24rem)",
  },
};

/** Tournament title clamps; the existing page-density cap remains authoritative. */
export const TOURNAMENT_FONT_SIZE_CSS: Record<InfoboardFontSize, string> = {
  SMALL: "clamp(0.874rem, 1.178vw, 1.976rem)",
  MEDIUM: "clamp(1.012rem, 1.364vw, 2.288rem)",
  LARGE: "clamp(1.15rem, 1.55vw, 2.6rem)",
  XLARGE: "clamp(1.288rem, 1.736vw, 2.912rem)",
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
 * Training logo CSS clamp values per preset.
 * MEDIUM preserves the former Screen 1 team-logo baseline (28–42px).
 */
export const TRAINING_LOGO_SIZE_CSS: Record<InfoboardLogoSize, string> = {
  SMALL: "clamp(1.375rem, 2.2vh, 2.125rem)",
  MEDIUM: "clamp(1.75rem, 2.8vh, 2.625rem)",
  LARGE: "clamp(2.125rem, 3.4vh, 3.125rem)",
  XLARGE: "clamp(2.5rem, 4vh, 3.625rem)",
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

export type Screen1PresentationConfig = {
  readonly trainingShowLogos: boolean;
  readonly trainingLogoSize: InfoboardLogoSize;
  readonly matchShowLogos: boolean;
  readonly matchLogoSize: InfoboardLogoSize;
  readonly tournamentShowLogos: boolean;
  readonly tournamentLogoSize: InfoboardLogoSize;
  readonly trainingFontSize: InfoboardFontSize;
  readonly matchFontSize: InfoboardFontSize;
  readonly tournamentFontSize: InfoboardFontSize;
};

/** @deprecated Use the generalized Screen1PresentationConfig name. */
export type Screen1LogoPresentationConfig = Screen1PresentationConfig;

export const DEFAULT_SCREEN1_PRESENTATION: Screen1PresentationConfig = {
  trainingShowLogos: true,
  trainingLogoSize: DEFAULT_INFOBOARD_LOGO_SIZE,
  matchShowLogos: true,
  matchLogoSize: DEFAULT_INFOBOARD_LOGO_SIZE,
  tournamentShowLogos: true,
  tournamentLogoSize: DEFAULT_INFOBOARD_LOGO_SIZE,
  trainingFontSize: DEFAULT_TRAINING_FONT_SIZE,
  matchFontSize: DEFAULT_MATCH_FONT_SIZE,
  tournamentFontSize: DEFAULT_TOURNAMENT_FONT_SIZE,
};

export const DEFAULT_SCREEN1_LOGO_PRESENTATION = DEFAULT_SCREEN1_PRESENTATION;

export function isInfoboardLogoSize(value: string | null | undefined): value is InfoboardLogoSize {
  return value != null && (INFOBOARD_LOGO_SIZES as readonly string[]).includes(value);
}

export function resolveInfoboardLogoSize(
  value: string | null | undefined,
): InfoboardLogoSize {
  return isInfoboardLogoSize(value) ? value : DEFAULT_INFOBOARD_LOGO_SIZE;
}

export function resolveInfoboardFontSize(
  value: string | null | undefined,
  fallback: InfoboardFontSize,
): InfoboardFontSize {
  return isInfoboardLogoSize(value) ? value : fallback;
}
