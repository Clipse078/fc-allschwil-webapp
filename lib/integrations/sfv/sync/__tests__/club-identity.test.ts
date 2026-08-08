/**
 * lib/integrations/sfv/sync/__tests__/club-identity.test.ts
 *
 * CLUB-DIRECTORY-02C — unit tests for the pure provider-club-identity index
 * builder. No network, no database — pure function tests only.
 */

import { describe, expect, it } from "vitest";

import { buildProviderClubIdIndex, resolveProviderClubId } from "../club-identity";
import type { ClubRankingEntry, TeamDetail } from "../../client";

function ownTeam(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 1001,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 1,
    teamLeagueName: "2. Liga",
    teamDivisionName: "Vorrunde",
    teamOrganisationId: 1,
    isTeamActive: true,
    ...overrides,
  };
}

function rankingEntry(overrides: Partial<ClubRankingEntry> = {}): ClubRankingEntry {
  return {
    leagueId: 1,
    leagueNumber: 1,
    leagueName: "2. Liga",
    divisionId: 1,
    divisionName: "Vorrunde",
    groupId: 1,
    groupName: "Gruppe 1",
    teamName: "FC Allschwil 1",
    clubNumber: 483,
    position: 1,
    matches: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    penaltyPoints: 0,
    goalsFor: 10,
    goalsAgainst: 4,
    points: 10,
    teamId: 1001,
    ...overrides,
  };
}

describe("buildProviderClubIdIndex — own teams (TeamDetail)", () => {
  it("indexes every own team's clubNumber by teamId", () => {
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex(
      [ownTeam({ teamId: 1001, clubNumber: 483 }), ownTeam({ teamId: 1002, clubNumber: 483 })],
      [],
    );

    expect(indexByTeamId.get(1001)).toBe(483);
    expect(indexByTeamId.get(1002)).toBe(483);
    expect(conflicts).toHaveLength(0);
  });
});

describe("buildProviderClubIdIndex — ranking (opponents)", () => {
  it("indexes opponent teams appearing only in ranking data", () => {
    const { indexByTeamId } = buildProviderClubIdIndex(
      [ownTeam({ teamId: 1001, clubNumber: 483 })],
      [
        rankingEntry({ teamId: 1001, clubNumber: 483 }),
        rankingEntry({ teamId: 2001, clubNumber: 700, teamName: "FC Therwil 1" }),
        rankingEntry({ teamId: 2002, clubNumber: 700, teamName: "FC Therwil 2" }),
        rankingEntry({ teamId: 3001, clubNumber: 850, teamName: "FC Aesch 1" }),
      ],
    );

    // Two different opponent teams from the SAME real club consolidate onto
    // the same clubNumber — this is the entire point of CLUB-DIRECTORY-02C.
    expect(indexByTeamId.get(2001)).toBe(700);
    expect(indexByTeamId.get(2002)).toBe(700);
    // A genuinely different club keeps a distinct clubNumber.
    expect(indexByTeamId.get(3001)).toBe(850);
    expect(indexByTeamId.get(3001)).not.toBe(indexByTeamId.get(2001));
  });

  it("does not consolidate two genuinely different clubs even with similar names", () => {
    const { indexByTeamId } = buildProviderClubIdIndex(
      [],
      [
        rankingEntry({ teamId: 4001, clubNumber: 111, teamName: "AC Rossoneri" }),
        rankingEntry({ teamId: 4002, clubNumber: 222, teamName: "AC Rossoneri Nord" }),
      ],
    );

    expect(indexByTeamId.get(4001)).toBe(111);
    expect(indexByTeamId.get(4002)).toBe(222);
  });

  it("returns an empty index for an empty ranking response (e.g. best-effort fetch failure)", () => {
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex([], []);
    expect(indexByTeamId.size).toBe(0);
    expect(conflicts).toHaveLength(0);
  });
});

describe("buildProviderClubIdIndex — conflict guard (avoid false consolidation)", () => {
  it("excludes a teamId reporting two different clubNumbers across sources instead of guessing", () => {
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex(
      [ownTeam({ teamId: 5001, clubNumber: 483 })],
      [rankingEntry({ teamId: 5001, clubNumber: 999 })],
    );

    expect(indexByTeamId.has(5001)).toBe(false);
    expect(conflicts).toEqual([{ teamId: 5001, observedClubIds: [483, 999] }]);
  });

  it("excludes a teamId reporting two different clubNumbers across two ranking rows", () => {
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex(
      [],
      [rankingEntry({ teamId: 6001, clubNumber: 100 }), rankingEntry({ teamId: 6001, clubNumber: 200 })],
    );

    expect(indexByTeamId.has(6001)).toBe(false);
    expect(conflicts[0]?.teamId).toBe(6001);
    expect(conflicts[0]?.observedClubIds).toEqual([100, 200]);
  });

  it("does not flag a conflict when the same teamId reports the SAME clubNumber twice", () => {
    const { indexByTeamId, conflicts } = buildProviderClubIdIndex(
      [ownTeam({ teamId: 7001, clubNumber: 483 })],
      [rankingEntry({ teamId: 7001, clubNumber: 483 })],
    );

    expect(indexByTeamId.get(7001)).toBe(483);
    expect(conflicts).toHaveLength(0);
  });
});

describe("buildProviderClubIdIndex — defensive numeric validation", () => {
  it("ignores non-positive-integer teamId/clubNumber values without throwing", () => {
    const { indexByTeamId } = buildProviderClubIdIndex(
      [ownTeam({ teamId: 0, clubNumber: 483 })],
      [rankingEntry({ teamId: 8001, clubNumber: -1 }), rankingEntry({ teamId: -5, clubNumber: 483 })],
    );

    expect(indexByTeamId.size).toBe(0);
  });
});

describe("resolveProviderClubId", () => {
  it("returns the resolved clubNumber for a covered teamId", () => {
    const { indexByTeamId } = buildProviderClubIdIndex([ownTeam({ teamId: 1001, clubNumber: 483 })], []);
    expect(resolveProviderClubId(indexByTeamId, 1001)).toBe(483);
  });

  it("returns null for a teamId not covered by this run's data", () => {
    const { indexByTeamId } = buildProviderClubIdIndex([ownTeam({ teamId: 1001, clubNumber: 483 })], []);
    expect(resolveProviderClubId(indexByTeamId, 9999)).toBeNull();
  });

  it("returns null when no index is supplied at all", () => {
    expect(resolveProviderClubId(undefined, 1001)).toBeNull();
  });
});
