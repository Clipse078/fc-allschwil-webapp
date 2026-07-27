/**
 * Tests for lib/integrations/sfv/sync/competition-mapper.ts
 *
 * Covers:
 *   A. extractCompetitionsFromTeamList — deduplication, skips zero leagueId
 *   B. inferCompetitionGender — gender inference
 *   C. hasCompetitionChanges — change detection
 */

import { describe, it, expect } from "vitest";
import {
  extractCompetitionsFromTeamList,
  inferCompetitionGender,
  hasCompetitionChanges,
} from "../competition-mapper";
import type { TeamDetail } from "../../client";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTeam(overrides: Partial<TeamDetail> = {}): TeamDetail {
  return {
    isHomeTeam: true,
    teamId: 1,
    teamName: "FC Allschwil 1",
    teamFullname: "FC Allschwil 1. Mannschaft",
    clubNumber: 483,
    clubName: "FC Allschwil",
    teamLeagueId: 100,
    teamLeagueName: "3. Liga Frauen",
    teamDivisionName: "Gruppe 1",
    teamOrganisationId: 1,
    isTeamActive: true,
    ...overrides,
  };
}

// ── A. extractCompetitionsFromTeamList ────────────────────────────────────────

describe("A. extractCompetitionsFromTeamList", () => {
  it("extracts one competition from a single team", () => {
    const result = extractCompetitionsFromTeamList([makeTeam()], 2027);
    expect(result).toHaveLength(1);
    expect(result[0].externalCompetitionId).toBe(100);
    expect(result[0].externalSeasonId).toBe(2027);
    expect(result[0].officialName).toBe("3. Liga Frauen");
    expect(result[0].groupName).toBe("Gruppe 1");
  });

  it("deduplicates teams with the same leagueId", () => {
    const teams = [
      makeTeam({ teamId: 1, teamLeagueId: 100 }),
      makeTeam({ teamId: 2, teamLeagueId: 100 }),
      makeTeam({ teamId: 3, teamLeagueId: 100 }),
    ];
    const result = extractCompetitionsFromTeamList(teams, 2027);
    expect(result).toHaveLength(1);
  });

  it("extracts multiple competitions for different leagues", () => {
    const teams = [
      makeTeam({ teamId: 1, teamLeagueId: 100, teamLeagueName: "Liga A" }),
      makeTeam({ teamId: 2, teamLeagueId: 200, teamLeagueName: "Liga B" }),
    ];
    const result = extractCompetitionsFromTeamList(teams, 2027);
    expect(result).toHaveLength(2);
  });

  it("skips teams with zero leagueId", () => {
    const teams = [makeTeam({ teamLeagueId: 0 })];
    const result = extractCompetitionsFromTeamList(teams, 2027);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty team list", () => {
    const result = extractCompetitionsFromTeamList([], 2027);
    expect(result).toHaveLength(0);
  });

  it("generates fallback name when teamLeagueName is null", () => {
    const result = extractCompetitionsFromTeamList(
      [makeTeam({ teamLeagueName: null, teamLeagueId: 999 })],
      2027,
    );
    expect(result[0].officialName).toBe("SFV League 999");
  });

  it("sets null groupName when teamDivisionName is null", () => {
    const result = extractCompetitionsFromTeamList(
      [makeTeam({ teamDivisionName: null })],
      2027,
    );
    expect(result[0].groupName).toBeNull();
  });
});

// ── B. inferCompetitionGender ─────────────────────────────────────────────────

describe("B. inferCompetitionGender", () => {
  it.each([
    ["3. Liga Frauen", "FEMALE"],
    ["Damen Nationalliga", "FEMALE"],
    ["Women's League", "FEMALE"],
    ["Herren Liga", "MALE"],
    ["Männer Cup", "MALE"],
    ["U15 Regional", null],
    ["Junioren Liga", null],
    ["", null],
  ])("infers gender from '%s' → %s", (name, expected) => {
    expect(inferCompetitionGender(name)).toBe(expected);
  });
});

// ── C. hasCompetitionChanges ─────────────────────────────────────────────────

describe("C. hasCompetitionChanges", () => {
  const base = { officialName: "Liga A", groupName: "Gruppe 1" };

  it("returns false when nothing changed", () => {
    expect(
      hasCompetitionChanges(base, {
        externalCompetitionId: 100,
        externalSeasonId: 2027,
        officialName: "Liga A",
        groupName: "Gruppe 1",
      }),
    ).toBe(false);
  });

  it("returns true when officialName changed", () => {
    expect(
      hasCompetitionChanges(base, {
        externalCompetitionId: 100,
        externalSeasonId: 2027,
        officialName: "Liga B",
        groupName: "Gruppe 1",
      }),
    ).toBe(true);
  });

  it("returns true when groupName changed", () => {
    expect(
      hasCompetitionChanges(base, {
        externalCompetitionId: 100,
        externalSeasonId: 2027,
        officialName: "Liga A",
        groupName: "Gruppe 2",
      }),
    ).toBe(true);
  });

  it("returns true when groupName changes from null to value", () => {
    expect(
      hasCompetitionChanges(
        { officialName: "Liga A", groupName: null },
        {
          externalCompetitionId: 100,
          externalSeasonId: 2027,
          officialName: "Liga A",
          groupName: "Gruppe 1",
        },
      ),
    ).toBe(true);
  });
});
