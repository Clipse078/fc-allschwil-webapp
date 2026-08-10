/**
 * lib/publishing/infoboard/display-theme.ts
 *
 * INFOBOARD-INTEGRATION-01B — Infoboard display theme (Dark / Light).
 *
 * Presentation-only preference for the public Infoboard displays. Persisted
 * on Tenant.infoboardDisplayTheme (nullable String, no DB-level enum — see
 * prisma/schema.prisma). This module is the single source of truth for:
 *   - the allowed theme values;
 *   - the default (DARK, the existing premium stadium theme);
 *   - validating/resolving a raw persisted or user-supplied value.
 *
 * Deliberately generic (not "screen1-*"): Tenant.infoboardDisplayTheme is a
 * tenant-level preference, not scoped to one screen — a future Screen 2
 * consumer resolves the same value through this same module, with no second
 * persistence mechanism or theme vocabulary.
 *
 * Design constraints:
 *   - Pure, synchronous, deterministic. No I/O, no DB access, no React.
 *   - Never used to influence planning data, publication policy, or resource
 *     allocation — presentation only.
 */

export const INFOBOARD_DISPLAY_THEMES = ["DARK", "LIGHT"] as const;

export type InfoboardDisplayTheme = (typeof INFOBOARD_DISPLAY_THEMES)[number];

/** DARK is the existing premium stadium/evening default (INFOBOARD-04A/04B). */
export const DEFAULT_INFOBOARD_DISPLAY_THEME: InfoboardDisplayTheme = "DARK";

/** Narrows an arbitrary value to InfoboardDisplayTheme. */
export function isInfoboardDisplayTheme(
  value: unknown,
): value is InfoboardDisplayTheme {
  return (
    typeof value === "string" &&
    (INFOBOARD_DISPLAY_THEME_SET as ReadonlySet<string>).has(value)
  );
}

const INFOBOARD_DISPLAY_THEME_SET: ReadonlySet<InfoboardDisplayTheme> =
  new Set(INFOBOARD_DISPLAY_THEMES);

/**
 * Resolves a raw persisted (or otherwise untrusted) value into a valid
 * InfoboardDisplayTheme.
 *
 * Resolution:
 *   - null / undefined / blank / unrecognised value → DEFAULT_INFOBOARD_DISPLAY_THEME
 *   - "DARK" / "LIGHT" (case-insensitive, trimmed) → the matching theme
 *
 * Always returns a valid value — callers never need a further null check.
 */
export function resolveInfoboardDisplayTheme(
  raw: string | null | undefined,
): InfoboardDisplayTheme {
  if (raw == null) return DEFAULT_INFOBOARD_DISPLAY_THEME;
  const normalized = raw.trim().toUpperCase();
  return isInfoboardDisplayTheme(normalized)
    ? normalized
    : DEFAULT_INFOBOARD_DISPLAY_THEME;
}
