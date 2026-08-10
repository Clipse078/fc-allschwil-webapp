/**
 * lib/teams/__tests__/current-season.test.ts
 *
 * TEAMCENTER-UX-01C — canonical "current TeamSeason" resolution.
 *
 * These are the low-level building blocks shared by getTeamsListData,
 * getTeamDetailData, GET /api/teams, findTeamSeasonsForTenant (the
 * TrainingCenter "Neue Trainingsserie" picker) and getOrgUnitById.
 */

import { describe, it, expect } from "vitest";
import { currentTeamSeasonWhere, pickCurrentTeamSeason } from "../current-season";

describe("currentTeamSeasonWhere", () => {
  it("resolves to { season: { isActive: true } } when no explicit key is given", () => {
    expect(currentTeamSeasonWhere()).toEqual({ season: { isActive: true } });
    expect(currentTeamSeasonWhere(undefined)).toEqual({ season: { isActive: true } });
    expect(currentTeamSeasonWhere(null)).toEqual({ season: { isActive: true } });
  });

  it("resolves to { season: { isActive: true } } for an empty/whitespace-only key", () => {
    expect(currentTeamSeasonWhere("")).toEqual({ season: { isActive: true } });
    expect(currentTeamSeasonWhere("   ")).toEqual({ season: { isActive: true } });
  });

  it("an explicit season key always wins", () => {
    expect(currentTeamSeasonWhere("2026/2027")).toEqual({ season: { key: "2026/2027" } });
  });

  it("trims the explicit season key", () => {
    expect(currentTeamSeasonWhere("  2026/2027  ")).toEqual({ season: { key: "2026/2027" } });
  });
});

describe("pickCurrentTeamSeason", () => {
  const oldSeason = { id: "ts-old", season: { key: "2024/2025", isActive: false } };
  const currentSeason = { id: "ts-current", season: { key: "2026/2027", isActive: true } };

  it("picks the entry whose Season.isActive is true when no explicit key is given", () => {
    expect(pickCurrentTeamSeason([oldSeason, currentSeason])).toBe(currentSeason);
  });

  it("returns null when no entry is flagged as the active season (does NOT fall back to the newest entry)", () => {
    // TEAMCENTER-UX-01C root-cause regression: this Team has TeamSeason rows
    // but none for the season currently flagged Season.isActive. The old
    // implementation silently substituted `teamSeasons[0]` here — exactly
    // why the Team detail page could disagree with the Teams list/
    // TrainingCenter for the very same Team.
    const staleOnly = [oldSeason];
    expect(pickCurrentTeamSeason(staleOnly)).toBeNull();
  });

  it("returns null for a Team with no TeamSeason rows at all", () => {
    expect(pickCurrentTeamSeason([])).toBeNull();
  });

  it("an explicit season key selects that season's entry, even if it is not Season.isActive", () => {
    expect(pickCurrentTeamSeason([oldSeason, currentSeason], "2024/2025")).toBe(oldSeason);
  });

  it("an explicit season key that matches nothing returns null (no silent fallback)", () => {
    expect(pickCurrentTeamSeason([oldSeason, currentSeason], "2030/2031")).toBeNull();
  });
});
