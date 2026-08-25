/**
 * lib/integrations/sfv/season-bridge.ts
 *
 * TEAM-SFV-01B — authoritative SFV externalSeasonId ↔ SCE Season bridge.
 *
 * SFV uses an integer season identifier where the value equals the *end*
 * year of the Swiss football season (e.g. 2027 for 2026/2027). SCE stores
 * seasons with a string key (canonical: "2026/2027").
 *
 * All conversions between these representations MUST go through this module.
 * Do not scatter ad-hoc `externalSeasonId - 1` logic across services.
 */

import { prisma } from "@/lib/db/prisma";
import { getSwissFootballSeasonKeyFromStartYear } from "@/lib/seasons/season-logic";

export const SFV_PROVIDER = "SFV";

export type ResolvedCanonicalSeason = {
  id: string;
  key: string;
};

/**
 * Derives the Swiss football season start year from an SFV externalSeasonId.
 *
 * SFV convention: externalSeasonId 2027 → start year 2026 → key "2026/2027".
 */
export function getSfvSeasonStartYear(externalSeasonId: number): number {
  if (!Number.isInteger(externalSeasonId) || externalSeasonId <= 0) {
    throw new Error(`Invalid SFV externalSeasonId: ${externalSeasonId}`);
  }
  return externalSeasonId - 1;
}

/**
 * Computes the canonical SCE Season.key for an SFV externalSeasonId.
 *
 * Pure, deterministic, no database access.
 */
export function getCanonicalSeasonKeyFromSfvExternalSeasonId(
  externalSeasonId: number,
): string {
  return getSwissFootballSeasonKeyFromStartYear(getSfvSeasonStartYear(externalSeasonId));
}

/**
 * Ordered Season.key candidates to try when resolving a Season row.
 *
 * The canonical slash format is tried first. A hyphen variant exists in
 * legacy data (e.g. "2026-2027") and is included as a deterministic fallback.
 *
 * Deliberately excludes end-year-first formats like "2027-2028" — those
 * represent a different season and must never be inferred from SFV 2027.
 */
export function getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(
  externalSeasonId: number,
): readonly string[] {
  const startYear = getSfvSeasonStartYear(externalSeasonId);
  const endYear = startYear + 1;
  return [
    getSwissFootballSeasonKeyFromStartYear(startYear),
    `${startYear}-${endYear}`,
  ];
}

/**
 * Resolves an SFV externalSeasonId to a canonical SCE Season row.
 *
 * Returns null when no matching Season exists (caller must fail closed).
 */
export async function resolveCanonicalSeasonFromSfvExternalSeasonId(
  externalSeasonId: number,
): Promise<ResolvedCanonicalSeason | null> {
  const candidates = getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(externalSeasonId);

  for (const key of candidates) {
    const season = await prisma.season.findUnique({
      where: { key },
      select: { id: true, key: true },
    });
    if (season) {
      return season;
    }
  }

  return null;
}
