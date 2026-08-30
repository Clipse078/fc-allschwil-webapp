/**
 * lib/club-directory/club-name-normalization.ts
 *
 * Shared normalization for tenant-scoped canonical club name matching.
 * Used by canonical club auto-resolution, tournament organizer lookup, and
 * other Club Directory consumers.
 */

/**
 * Normalizes a club/team label for deterministic directory lookup.
 * Collapses hyphen/slash variants and repeated whitespace so that e.g.
 * "FC Diegten-Eptingen" matches "FC Diegten Eptingen".
 */
export function normalizeClubNameForLookup(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Returns true when `normalizedText` has a token boundary immediately after
 * the given prefix length (end of string or whitespace separator).
 */
export function hasCanonicalPrefixBoundary(
  normalizedText: string,
  prefixLength: number,
): boolean {
  if (prefixLength === normalizedText.length) {
    return true;
  }

  return normalizedText[prefixLength] === " ";
}
