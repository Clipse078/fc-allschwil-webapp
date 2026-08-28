import { describe, expect, it } from "vitest";
import {
  formatStandingsGoalDifference,
  formatStandingsGoals,
  formatStandingsPenaltyPoints,
  formatStandingsRecord,
} from "../team-standings-formatters";
import type { TeamCockpitStandingsRow } from "@/lib/teams/team-cockpit-sporting-data";

function createRow(overrides: Partial<TeamCockpitStandingsRow> = {}): TeamCockpitStandingsRow {
  return {
    position: 1,
    teamName: "FC Test",
    shortName: null,
    isCurrentTeam: false,
    logoUrl: null,
    played: 10,
    won: 5,
    drawn: 2,
    lost: 3,
    goalsFor: 15,
    goalsAgainst: 10,
    goalDifference: 5,
    points: 17,
    penaltyPoints: null,
    ...overrides,
  };
}

describe("team-standings-formatters", () => {
  it("formats positive goal difference", () => {
    expect(formatStandingsGoalDifference(12)).toBe("+12");
  });

  it("formats zero goal difference", () => {
    expect(formatStandingsGoalDifference(0)).toBe("0");
  });

  it("formats negative goal difference", () => {
    expect(formatStandingsGoalDifference(-4)).toBe("-4");
  });

  it("formats goals as for:against", () => {
    expect(formatStandingsGoals(18, 6)).toBe("18:6");
  });

  it("formats W-D-L record", () => {
    expect(formatStandingsRecord(createRow({ won: 4, drawn: 1, lost: 2 }))).toBe("4-1-2");
  });

  it("returns null for zero/null penalty points", () => {
    expect(formatStandingsPenaltyPoints(null)).toBeNull();
    expect(formatStandingsPenaltyPoints(0)).toBeNull();
  });

  it("formats non-zero penalty points restrainedly", () => {
    expect(formatStandingsPenaltyPoints(2)).toBe("−2 Strafpkt.");
  });
});
