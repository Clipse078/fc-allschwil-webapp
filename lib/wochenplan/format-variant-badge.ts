/**
 * lib/wochenplan/format-variant-badge.ts
 *
 * Pure, client-safe formatting helpers for the Wochenplan variant badge.
 * No Prisma / server-only imports — safe to use in both Server Components
 * and "use client" components.
 */

/**
 * Parses the ISO week number from a weekId like "2026-W23".
 * Returns null for unrecognised formats.
 */
export function parseWeekNumber(weekId: string): number | null {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(weekId);
  return match ? parseInt(match[2], 10) : null;
}

/**
 * Formats the canonical week-label string shown on the public website
 * and InfoBoard: "KW 23 | Schlechtwetter-Wochenplan aktiv"
 */
export function formatWochenplanVariantBadge(
  weekId: string,
  variantLabel: string,
): string {
  const weekNumber = parseWeekNumber(weekId);
  return weekNumber !== null
    ? `KW ${weekNumber} | ${variantLabel} aktiv`
    : `${weekId} | ${variantLabel} aktiv`;
}
