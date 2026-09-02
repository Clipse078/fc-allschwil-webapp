/**
 * lib/transport/transport-line-colors.ts
 *
 * Deterministic transport line badge colors for Infoboard Screen 2.
 * Same line identifier always resolves to the same color across refreshes.
 */

export type TransportLineColor = {
  /** CSS color for badge background. */
  background: string;
  /** CSS color for badge foreground (line number). */
  foreground: string;
};

/**
 * Curated palette for public-transport line badges.
 * Saturated, distinguishable hues with sufficient contrast for white text.
 */
const LINE_COLOR_PALETTE: readonly string[] = [
  "#0B4AA2",
  "#C7332C",
  "#15803D",
  "#B45309",
  "#7C3AED",
  "#0E7490",
  "#BE185D",
  "#1D4ED8",
  "#047857",
  "#C2410C",
  "#6D28D9",
  "#0369A1",
  "#A21CAF",
  "#4D7C0F",
  "#B91C1C",
  "#155E75",
] as const;

const BADGE_FOREGROUND = "#FFFFFF";

function hashLineIdentifier(line: string): number {
  const normalized = line.trim().toUpperCase();
  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 33) ^ normalized.charCodeAt(index);
  }
  return Math.abs(hash);
}

function normalizeProviderColor(color: string | null | undefined): string | null {
  if (!color) {
    return null;
  }

  const trimmed = color.trim();
  if (!trimmed) {
    return null;
  }

  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }

  if (/^rgb(a)?\(/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function resolvePaletteColor(line: string): string {
  const index = hashLineIdentifier(line) % LINE_COLOR_PALETTE.length;
  return LINE_COLOR_PALETTE[index] ?? LINE_COLOR_PALETTE[0];
}

/**
 * Resolve a stable badge color for a transport line.
 *
 * Provider colors are preferred when supplied and parseable; otherwise a
 * deterministic SCE palette entry is derived from the line identifier.
 */
export function resolveTransportLineColor(
  line: string,
  providerColor?: string | null,
): TransportLineColor {
  const background = normalizeProviderColor(providerColor) ?? resolvePaletteColor(line);

  return {
    background,
    foreground: BADGE_FOREGROUND,
  };
}
