/**
 * lib/integrations/sfv/sync/__tests__/team-competition-context.test.ts
 *
 * CLUB-DIRECTORY-04 — unit tests for the pure provider-competition-context
 * index builder. No network, no database — pure function tests only.
 */

import { describe, expect, it } from "vitest";

import {
  buildProviderCompetitionContextIndex,
  resolveProviderCompetitionContext,
} from "../team-competition-context";
import type { ClubRankingEntry } from "../../client";

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

describe("buildProviderCompetitionContextIndex", () => {
  it("indexes real per-team league and group names from ranking data", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 1001, leagueName: "3. Liga", groupName: "Gruppe 1" }),
    ]);

    expect(index.get(1001)).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
  });

  it("distinguishes four identically-named opponent teams (AC Rossoneri) by real league/group context", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 4001, teamName: "AC Rossoneri", leagueName: "3. Liga", groupName: "Gruppe 1" }),
      rankingEntry({ teamId: 4002, teamName: "AC Rossoneri", leagueName: "2. Liga", groupName: "Gruppe 2" }),
      rankingEntry({
        teamId: 4003,
        teamName: "AC Rossoneri",
        leagueName: "Senioren 30+",
        groupName: "Gruppe 2",
      }),
      rankingEntry({ teamId: 4004, teamName: "AC Rossoneri", leagueName: "Junioren B", groupName: "Promotion" }),
    ]);

    expect(index.get(4001)).toEqual({ leagueName: "3. Liga", groupName: "Gruppe 1" });
    expect(index.get(4002)).toEqual({ leagueName: "2. Liga", groupName: "Gruppe 2" });
    expect(index.get(4003)).toEqual({ leagueName: "Senioren 30+", groupName: "Gruppe 2" });
    expect(index.get(4004)).toEqual({ leagueName: "Junioren B", groupName: "Promotion" });

    // Every context is genuinely distinct — never the same object reused.
    const contexts = [4001, 4002, 4003, 4004].map((id) => index.get(id));
    const distinctSerialized = new Set(contexts.map((c) => JSON.stringify(c)));
    expect(distinctSerialized.size).toBe(4);
  });

  it("renders partial context gracefully when only a league name is available", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 5001, leagueName: "3. Liga", groupName: null }),
    ]);

    expect(index.get(5001)).toEqual({ leagueName: "3. Liga", groupName: null });
  });

  it("renders partial context gracefully when only a group name is available", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 5002, leagueName: null, groupName: "Gruppe 2" }),
    ]);

    expect(index.get(5002)).toEqual({ leagueName: null, groupName: "Gruppe 2" });
  });

  it("skips an entry with neither a league nor a group name — never records an empty-but-known context", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 6001, leagueName: null, groupName: null }),
    ]);

    expect(index.has(6001)).toBe(false);
  });

  it("trims whitespace-only provider values to null instead of treating them as real context", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 6002, leagueName: "   ", groupName: "Gruppe 1" }),
    ]);

    expect(index.get(6002)).toEqual({ leagueName: null, groupName: "Gruppe 1" });
  });

  it("the last entry observed for a teamId wins — never a conflict error (context is descriptive, not identity)", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 7001, leagueName: "3. Liga", groupName: "Gruppe 1" }),
      rankingEntry({ teamId: 7001, leagueName: "2. Liga", groupName: "Gruppe 2" }),
    ]);

    expect(index.get(7001)).toEqual({ leagueName: "2. Liga", groupName: "Gruppe 2" });
  });

  it("ignores non-positive-integer teamId values without throwing", () => {
    const index = buildProviderCompetitionContextIndex([rankingEntry({ teamId: 0 }), rankingEntry({ teamId: -5 })]);

    expect(index.size).toBe(0);
  });

  it("returns an empty index for an empty ranking response (e.g. best-effort fetch failure)", () => {
    const index = buildProviderCompetitionContextIndex([]);
    expect(index.size).toBe(0);
  });
});

describe("resolveProviderCompetitionContext", () => {
  it("returns the resolved context for a covered teamId", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 1001, leagueName: "3. Liga", groupName: "Gruppe 1" }),
    ]);

    expect(resolveProviderCompetitionContext(index, 1001)).toEqual({
      leagueName: "3. Liga",
      groupName: "Gruppe 1",
    });
  });

  it("returns an all-null context for a teamId not covered by this run's ranking data — never a guess", () => {
    const index = buildProviderCompetitionContextIndex([
      rankingEntry({ teamId: 1001, leagueName: "3. Liga", groupName: "Gruppe 1" }),
    ]);

    expect(resolveProviderCompetitionContext(index, 9999)).toEqual({
      leagueName: null,
      groupName: null,
    });
  });

  it("returns an all-null context when no index is supplied at all", () => {
    expect(resolveProviderCompetitionContext(undefined, 1001)).toEqual({
      leagueName: null,
      groupName: null,
    });
  });
});
