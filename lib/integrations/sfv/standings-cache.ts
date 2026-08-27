/**
 * lib/integrations/sfv/standings-cache.ts
 *
 * Process-local read-through cache for club+season scoped SFV ranking payloads.
 */

import type { ClubRankingEntry } from "./client";

export const STANDINGS_CACHE_TTL_MS = 3 * 60 * 1000;
const STANDINGS_CACHE_MAX_ENTRIES = 64;

type CacheEntry = {
  entries: ClubRankingEntry[];
  expiresAt: number;
};

const standingsCache = new Map<string, CacheEntry>();

export function buildStandingsCacheKey(
  tenantId: string,
  externalSeasonId: number,
): string {
  return `${tenantId}:${externalSeasonId}`;
}

/** Test-only helper — not exposed as a public runtime API. */
export function resetStandingsCacheForTests(): void {
  standingsCache.clear();
}

export function getCachedStandingsEntries(
  cacheKey: string,
  now: number = Date.now(),
): ClubRankingEntry[] | null {
  const cached = standingsCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    standingsCache.delete(cacheKey);
    return null;
  }

  return cached.entries;
}

export function setCachedStandingsEntries(
  cacheKey: string,
  entries: ClubRankingEntry[],
  now: number = Date.now(),
): void {
  if (standingsCache.size >= STANDINGS_CACHE_MAX_ENTRIES) {
    const oldestKey = standingsCache.keys().next().value;
    if (oldestKey) {
      standingsCache.delete(oldestKey);
    }
  }

  standingsCache.set(cacheKey, {
    entries,
    expiresAt: now + STANDINGS_CACHE_TTL_MS,
  });
}
