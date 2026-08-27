import { describe, expect, it } from "vitest";

import type { ClubRankingEntry } from "../client";
import { resolveStandingsTable } from "../standings-table";

function createEntry(
  overrides: Partial<ClubRankingEntry> & Pick<ClubRankingEntry, "teamId" | "position">,
): ClubRankingEntry {
  return {
    leagueId: 10,
    leagueNumber: 1,
    leagueName: "League A",
    divisionId: 20,
    divisionName: "Division A",
    groupId: 30,
    groupName: "Group A",
    teamName: `Team ${overrides.teamId}`,
    clubNumber: 100,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    penaltyPoints: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    ...overrides,
  };
}

describe("resolveStandingsTable", () => {
  it("A. selects the table when exactly one anchor exists", () => {
    const entries = [
      createEntry({ teamId: 100, position: 1 }),
      createEntry({ teamId: 200, position: 2 }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.rows).toHaveLength(2);
    expect(table?.competition.name).toBe("League A");
  });

  it("B. handles multiple ranking tables and filters by tuple", () => {
    const entries = [
      createEntry({ teamId: 100, position: 1, leagueId: 10, divisionId: 20, groupId: 30 }),
      createEntry({ teamId: 200, position: 2, leagueId: 10, divisionId: 20, groupId: 30 }),
      createEntry({ teamId: 100, position: 3, leagueId: 11, divisionId: 21, groupId: 31, leagueName: "League B" }),
      createEntry({ teamId: 300, position: 1, leagueId: 11, divisionId: 21, groupId: 31, leagueName: "League B" }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
      providerLeagueId: 11,
    });

    expect(table?.competition.name).toBe("League B");
    expect(table?.rows.map((row) => row.externalTeamId)).toEqual([300, 100]);
  });

  it("C. uses providerLeagueId to disambiguate anchors", () => {
    const entries = [
      createEntry({ teamId: 100, position: 2, leagueId: 10, leagueName: "Cup" }),
      createEntry({ teamId: 100, position: 4, leagueId: 20, leagueName: "League" }),
      createEntry({ teamId: 200, position: 1, leagueId: 20, leagueName: "League" }),
      createEntry({ teamId: 300, position: 3, leagueId: 20, leagueName: "League" }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
      providerLeagueId: 20,
    });

    expect(table?.competition.name).toBe("League");
    expect(table?.rows).toHaveLength(3);
  });

  it("D. is not affected by incoming array order", () => {
    const ordered = [
      createEntry({ teamId: 300, position: 3 }),
      createEntry({ teamId: 100, position: 1 }),
      createEntry({ teamId: 200, position: 2 }),
    ];
    const reversed = [...ordered].reverse();

    const left = resolveStandingsTable({
      entries: ordered,
      externalTeamId: 100,
    });
    const right = resolveStandingsTable({
      entries: reversed,
      externalTeamId: 100,
    });

    expect(left).toEqual(right);
  });

  it("E. filters rows by exact league/division/group tuple", () => {
    const entries = [
      createEntry({ teamId: 100, position: 1, leagueId: 10, divisionId: 20, groupId: 30 }),
      createEntry({ teamId: 200, position: 2, leagueId: 10, divisionId: 20, groupId: 30 }),
      createEntry({ teamId: 300, position: 1, leagueId: 10, divisionId: 20, groupId: 31 }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.rows.map((row) => row.externalTeamId)).toEqual([100, 200]);
  });

  it("F. sorts rows by position ascending", () => {
    const entries = [
      createEntry({ teamId: 300, position: 3 }),
      createEntry({ teamId: 100, position: 1 }),
      createEntry({ teamId: 200, position: 2 }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.rows.map((row) => row.position)).toEqual([1, 2, 3]);
  });

  it("G. preserves authoritative provider positions", () => {
    const entries = [
      createEntry({
        teamId: 100,
        position: 2,
        goalsFor: 25,
        goalsAgainst: 8,
        points: 20,
      }),
      createEntry({
        teamId: 200,
        position: 1,
        goalsFor: 10,
        goalsAgainst: 10,
        points: 15,
      }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.rows[0]?.position).toBe(1);
    expect(table?.rows[1]?.position).toBe(2);
  });

  it("H. returns null when the team is missing", () => {
    const table = resolveStandingsTable({
      entries: [createEntry({ teamId: 200, position: 1 })],
      externalTeamId: 999,
    });

    expect(table).toBeNull();
  });

  it("I. handles duplicate anchors deterministically by tuple", () => {
    const entries = [
      createEntry({ teamId: 100, position: 1, leagueId: 30, divisionId: 1, groupId: 1 }),
      createEntry({ teamId: 100, position: 2, leagueId: 10, divisionId: 1, groupId: 1 }),
      createEntry({ teamId: 200, position: 1, leagueId: 10, divisionId: 1, groupId: 1 }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.competition.name).toBe("League A");
    expect(table?.rows.map((row) => row.externalTeamId)).toEqual([200, 100]);
  });

  it("maps provider stats fields", () => {
    const entries = [
      createEntry({
        teamId: 100,
        position: 3,
        matches: 12,
        wins: 6,
        draws: 3,
        losses: 3,
        goalsFor: 25,
        goalsAgainst: 8,
        points: 21,
        penaltyPoints: 2,
      }),
    ];

    const table = resolveStandingsTable({
      entries,
      externalTeamId: 100,
    });

    expect(table?.rows[0]).toMatchObject({
      position: 3,
      played: 12,
      won: 6,
      drawn: 3,
      lost: 3,
      goalsFor: 25,
      goalsAgainst: 8,
      points: 21,
      penaltyPoints: 2,
    });
  });
});
