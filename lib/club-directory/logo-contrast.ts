/**
 * lib/club-directory/logo-contrast.ts
 *
 * Canonical logo contrast presentation for dark surfaces.
 *
 * Explicit, deterministic marking only — no image analysis or name heuristics.
 * Consumers apply CSS inversion when `surface` is dark and contrast mode is
 * `invert-on-dark`.
 *
 * Persistence: optional `logoContrastMode` on ExternalClub / Tenant (schema
 * slice pending). Until then, resolvers treat absent values as `normal`.
 */

export const LOGO_CONTRAST_MODES = ["normal", "invert-on-dark"] as const;

export type LogoContrastMode = (typeof LOGO_CONTRAST_MODES)[number];

export type LogoContrastSource = {
  readonly logoContrastMode?: string | null;
};

const INVERT_ON_DARK_ALIASES = new Set([
  "INVERT_ON_DARK",
  "INVERT-ON-DARK",
  "invert-on-dark",
  "invert_on_dark",
]);

/**
 * Resolves the presentation contrast mode for a club/tenant logo identity.
 * Unknown or absent values default to `normal`.
 */
export function resolveLogoContrastMode(
  source: LogoContrastSource | null | undefined,
): LogoContrastMode {
  const raw = source?.logoContrastMode?.trim();
  if (!raw) return "normal";
  if (INVERT_ON_DARK_ALIASES.has(raw) || INVERT_ON_DARK_ALIASES.has(raw.toUpperCase())) {
    return "invert-on-dark";
  }
  return "normal";
}

/**
 * Whether a crest should render with dark-surface inversion applied.
 */
export function shouldInvertLogoOnDarkSurface(
  contrastMode: LogoContrastMode,
  isDarkSurface: boolean,
  hasLogoUrl: boolean,
): boolean {
  return hasLogoUrl && isDarkSurface && contrastMode === "invert-on-dark";
}
