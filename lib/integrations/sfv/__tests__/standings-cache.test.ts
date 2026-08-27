import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubRankingEntry } from "../client";
import {
  buildStandingsCacheKey,
  getCachedStandingsEntries,
  resetStandingsCacheForTests,
  setCachedStandingsEntries,
  STANDINGS_CACHE_TTL_MS,
} from "../standings-cache";

function createEntry(teamId: number): ClubRankingEntry {
  return {
    leagueId: 10,
    leagueNumber: 1,
    leagueName: "League",
    divisionId: 20,
    divisionName: null,
    groupId: 30,
    groupName: null,
    teamName: `Team ${teamId}`,
    clubNumber: 100,
    position: 1,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    penaltyPoints: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    teamId,
  };
}

describe("standings cache", () => {
  beforeEach(() => {
    resetStandingsCacheForTests();
  });

  it("reuses cache for the same tenant and season", () => {
    const key = buildStandingsCacheKey("tenant-a", 2027);
    const entries = [createEntry(100)];

    setCachedStandingsEntries(key, entries, 1_000);
    expect(getCachedStandingsEntries(key, 1_000)).toEqual(entries);
  });

  it("does not reuse cache across tenants", () => {
    const tenantAKey = buildStandingsCacheKey("tenant-a", 2027);
    const tenantBKey = buildStandingsCacheKey("tenant-b", 2027);

    setCachedStandingsEntries(tenantAKey, [createEntry(100)], 1_000);

    expect(getCachedStandingsEntries(tenantBKey, 1_000)).toBeNull();
  });

  it("does not reuse cache across seasons", () => {
    const season2027Key = buildStandingsCacheKey("tenant-a", 2027);
    const season2026Key = buildStandingsCacheKey("tenant-a", 2026);

    setCachedStandingsEntries(season2027Key, [createEntry(100)], 1_000);

    expect(getCachedStandingsEntries(season2026Key, 1_000)).toBeNull();
  });

  it("refetches after TTL expiry", () => {
    const key = buildStandingsCacheKey("tenant-a", 2027);
    setCachedStandingsEntries(key, [createEntry(100)], 1_000);

    expect(
      getCachedStandingsEntries(key, 1_000 + STANDINGS_CACHE_TTL_MS + 1),
    ).toBeNull();
  });

  it("does not poison unrelated tenant cache entries", () => {
    const tenantAKey = buildStandingsCacheKey("tenant-a", 2027);
    const tenantBKey = buildStandingsCacheKey("tenant-b", 2027);
    const tenantAEntries = [createEntry(100)];
    const tenantBEntries = [createEntry(200)];

    setCachedStandingsEntries(tenantAKey, tenantAEntries, 1_000);
    setCachedStandingsEntries(tenantBKey, tenantBEntries, 1_000);

    expect(getCachedStandingsEntries(tenantAKey, 1_000)).toEqual(tenantAEntries);
    expect(getCachedStandingsEntries(tenantBKey, 1_000)).toEqual(tenantBEntries);
  });
});
