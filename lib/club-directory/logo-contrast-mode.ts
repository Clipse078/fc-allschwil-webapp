/**
 * CLUB-LOGO-CONTRAST-01A — canonical logo contrast mode for ExternalClub.
 *
 * Persisted metadata only — does not modify the stored crest file. Dark-surface
 * consumers (e.g. Infoboard Screen 1, PR #498) map INVERT_ON_DARK to their
 * presentation mode when rendering.
 */

export const LOGO_CONTRAST_MODES = {
  NORMAL: "NORMAL",
  INVERT_ON_DARK: "INVERT_ON_DARK",
} as const;

export type LogoContrastMode = (typeof LOGO_CONTRAST_MODES)[keyof typeof LOGO_CONTRAST_MODES];

export const ALL_LOGO_CONTRAST_MODES: LogoContrastMode[] = [
  LOGO_CONTRAST_MODES.NORMAL,
  LOGO_CONTRAST_MODES.INVERT_ON_DARK,
];

export const DEFAULT_LOGO_CONTRAST_MODE: LogoContrastMode = LOGO_CONTRAST_MODES.NORMAL;

/** Returns true iff the value is a known LogoContrastMode. */
export function isValidLogoContrastMode(value: unknown): value is LogoContrastMode {
  return typeof value === "string" && ALL_LOGO_CONTRAST_MODES.includes(value as LogoContrastMode);
}

/**
 * Normalizes a persisted or serialized value to a known mode.
 * Unknown/absent values fall back to NORMAL for backward-compatible reads.
 */
export function normalizeLogoContrastMode(value: unknown): LogoContrastMode {
  return isValidLogoContrastMode(value) ? value : DEFAULT_LOGO_CONTRAST_MODE;
}
