/**
 * Season-aware URL construction helpers.
 *
 * Extracted from AdminPageActions to centralise the URL-building pattern and
 * make it testable and reusable across components.
 *
 * Behaviour:
 *   - If selectedSeason is null/empty, returns basePath unchanged.
 *   - If selectedSeason is set, appends ?season=<encoded> to basePath.
 *   - basePath must NOT already contain a query string (append-only).
 */

/**
 * Builds a season-aware URL for a given basePath.
 * Encodes the season key using encodeURIComponent.
 */
export function buildSeasonUrl(
  basePath: string,
  selectedSeason: string | null | undefined,
): string {
  if (!selectedSeason) return basePath;
  return `${basePath}?season=${encodeURIComponent(selectedSeason)}`;
}

/**
 * Returns a helper bound to the current selectedSeason.
 * Saves repeating the selectedSeason argument at every call site.
 *
 * Usage:
 *   const seasonUrl = makeSeasonUrl(selectedSeason);
 *   const href = seasonUrl("/dashboard/planner");
 */
export function makeSeasonUrl(
  selectedSeason: string | null | undefined,
): (basePath: string) => string {
  return (basePath: string) => buildSeasonUrl(basePath, selectedSeason);
}
