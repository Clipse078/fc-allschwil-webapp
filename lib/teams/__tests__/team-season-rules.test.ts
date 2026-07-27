/**
 * Tests for lib/teams/team-season-rules.ts
 *
 * Covers:
 *   A. buildTeamSeasonDisplayName — no FC Allschwil hardcoding, tenant-neutral
 *   B. buildTeamSeasonShortName
 *   C. normalizeTeamName / normalizeTeamSlug
 *   D. getEffectiveWebsiteVisible / getEffectiveInfoboardVisible
 *   E. getEffectiveTeamSeasonVisibility — full object helper
 *
 * No DB access. No I/O. Pure unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildTeamSeasonDisplayName,
  buildTeamSeasonShortName,
  normalizeTeamName,
  normalizeTeamSlug,
  getEffectiveWebsiteVisible,
  getEffectiveInfoboardVisible,
  getEffectiveTeamSeasonVisibility,
} from "../team-season-rules";

// ---------------------------------------------------------------------------
// A. buildTeamSeasonDisplayName — tenant-neutral, no FC Allschwil hardcoding
// ---------------------------------------------------------------------------

describe("buildTeamSeasonDisplayName", () => {
  it("returns team name only when no club display name is provided", () => {
    expect(buildTeamSeasonDisplayName("E-Junioren 1")).toBe("E-Junioren 1");
  });

  it("returns team name only when clubDisplayName is null", () => {
    expect(buildTeamSeasonDisplayName("E-Junioren 1", null)).toBe("E-Junioren 1");
  });

  it("returns team name only when clubDisplayName is undefined", () => {
    expect(buildTeamSeasonDisplayName("E-Junioren 1", undefined)).toBe("E-Junioren 1");
  });

  it("returns team name only when clubDisplayName is empty string", () => {
    expect(buildTeamSeasonDisplayName("E-Junioren 1", "")).toBe("E-Junioren 1");
  });

  it("returns team name only when clubDisplayName is whitespace only", () => {
    expect(buildTeamSeasonDisplayName("E-Junioren 1", "   ")).toBe("E-Junioren 1");
  });

  it("does NOT hardcode FC Allschwil — neutral output without club name", () => {
    const result = buildTeamSeasonDisplayName("E-Junioren 1");
    expect(result).not.toContain("FC Allschwil");
    expect(result).toBe("E-Junioren 1");
  });

  it("supports FC Allschwil as an explicit optional argument", () => {
    const result = buildTeamSeasonDisplayName("E-Junioren 1", "FC Allschwil");
    expect(result).toBe("FC Allschwil E-Junioren 1");
  });

  it("supports another club name — tenant-neutral", () => {
    expect(buildTeamSeasonDisplayName("1. Mannschaft", "FC Basel")).toBe(
      "FC Basel 1. Mannschaft",
    );
  });

  it("normalizes whitespace in team name", () => {
    expect(buildTeamSeasonDisplayName("  E-Junioren   1  ")).toBe("E-Junioren 1");
  });

  it("normalizes whitespace in both team name and club display name", () => {
    expect(
      buildTeamSeasonDisplayName("  E-Junioren   1  ", "  FC Allschwil  "),
    ).toBe("FC Allschwil E-Junioren 1");
  });

  it("produces no leading/trailing/double whitespace", () => {
    const result = buildTeamSeasonDisplayName("Aktive", "FC Test");
    expect(result).toBe("FC Test Aktive");
    expect(result.startsWith(" ")).toBe(false);
    expect(result.endsWith(" ")).toBe(false);
    expect(result.includes("  ")).toBe(false);
  });

  it("handles empty team name gracefully", () => {
    expect(buildTeamSeasonDisplayName("", "FC Test")).toBe("FC Test");
  });
});

// ---------------------------------------------------------------------------
// B. buildTeamSeasonShortName
// ---------------------------------------------------------------------------

describe("buildTeamSeasonShortName", () => {
  it("returns normalized team name", () => {
    expect(buildTeamSeasonShortName("E-Junioren 1")).toBe("E-Junioren 1");
  });

  it("normalizes whitespace", () => {
    expect(buildTeamSeasonShortName("  E-Junioren   1  ")).toBe("E-Junioren 1");
  });
});

// ---------------------------------------------------------------------------
// C. normalizeTeamName / normalizeTeamSlug
// ---------------------------------------------------------------------------

describe("normalizeTeamName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeTeamName("  Team Name  ")).toBe("Team Name");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeTeamName("Team   Name")).toBe("Team Name");
  });
});

describe("normalizeTeamSlug", () => {
  it("lowercases the input", () => {
    expect(normalizeTeamSlug("AKTIVE")).toBe("aktive");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeTeamSlug("e junioren 1")).toBe("e-junioren-1");
  });

  it("removes leading and trailing hyphens", () => {
    expect(normalizeTeamSlug("-aktive-")).toBe("aktive");
  });

  it("strips non-alphanumeric characters", () => {
    expect(normalizeTeamSlug("team/1")).toBe("team-1");
  });
});

// ---------------------------------------------------------------------------
// D. getEffectiveWebsiteVisible / getEffectiveInfoboardVisible
// ---------------------------------------------------------------------------

describe("getEffectiveWebsiteVisible", () => {
  it("returns Team value when TeamSeason value is null (null → inherit)", () => {
    expect(getEffectiveWebsiteVisible(null, true)).toBe(true);
    expect(getEffectiveWebsiteVisible(null, false)).toBe(false);
  });

  it("returns Team value when TeamSeason value is undefined (undefined → inherit)", () => {
    expect(getEffectiveWebsiteVisible(undefined, true)).toBe(true);
    expect(getEffectiveWebsiteVisible(undefined, false)).toBe(false);
  });

  it("explicit TeamSeason true overrides Team false", () => {
    expect(getEffectiveWebsiteVisible(true, false)).toBe(true);
  });

  it("explicit TeamSeason false overrides Team true", () => {
    expect(getEffectiveWebsiteVisible(false, true)).toBe(false);
  });

  it("both true → true", () => {
    expect(getEffectiveWebsiteVisible(true, true)).toBe(true);
  });

  it("both false → false", () => {
    expect(getEffectiveWebsiteVisible(false, false)).toBe(false);
  });
});

describe("getEffectiveInfoboardVisible", () => {
  it("returns Team value when TeamSeason value is null", () => {
    expect(getEffectiveInfoboardVisible(null, true)).toBe(true);
    expect(getEffectiveInfoboardVisible(null, false)).toBe(false);
  });

  it("explicit TeamSeason true overrides Team false", () => {
    expect(getEffectiveInfoboardVisible(true, false)).toBe(true);
  });

  it("explicit TeamSeason false overrides Team true", () => {
    expect(getEffectiveInfoboardVisible(false, true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E. getEffectiveTeamSeasonVisibility — full object helper
// ---------------------------------------------------------------------------

describe("getEffectiveTeamSeasonVisibility", () => {
  const team = { websiteVisible: true, infoboardVisible: false };

  it("inherits Team values when teamSeason is null", () => {
    expect(getEffectiveTeamSeasonVisibility(null, team)).toEqual({
      websiteVisible: true,
      infoboardVisible: false,
    });
  });

  it("inherits Team values when teamSeason is undefined", () => {
    expect(getEffectiveTeamSeasonVisibility(undefined, team)).toEqual({
      websiteVisible: true,
      infoboardVisible: false,
    });
  });

  it("TeamSeason true overrides Team false (website)", () => {
    const teamWithFalse = { websiteVisible: false, infoboardVisible: false };
    const teamSeason = { websiteVisible: true, infoboardVisible: false };
    expect(getEffectiveTeamSeasonVisibility(teamSeason, teamWithFalse)).toEqual({
      websiteVisible: true,
      infoboardVisible: false,
    });
  });

  it("TeamSeason false overrides Team true (infoboard)", () => {
    const teamWithTrue = { websiteVisible: true, infoboardVisible: true };
    const teamSeason = { websiteVisible: true, infoboardVisible: false };
    expect(getEffectiveTeamSeasonVisibility(teamSeason, teamWithTrue)).toEqual({
      websiteVisible: true,
      infoboardVisible: false,
    });
  });

  it("historical seasons may have different visibility values", () => {
    // Simulate two different seasons for the same team having different visibility
    const teamBase = { websiteVisible: true, infoboardVisible: true };

    const season2024 = { websiteVisible: true, infoboardVisible: false };
    const season2025 = { websiteVisible: false, infoboardVisible: true };

    expect(getEffectiveTeamSeasonVisibility(season2024, teamBase)).toEqual({
      websiteVisible: true,
      infoboardVisible: false,
    });

    expect(getEffectiveTeamSeasonVisibility(season2025, teamBase)).toEqual({
      websiteVisible: false,
      infoboardVisible: true,
    });
  });

  it("existing records preserve current behavior (both true by default)", () => {
    // Simulates the existing state where both fields default to true
    const existingTeam = { websiteVisible: true, infoboardVisible: true };
    const existingTeamSeason = { websiteVisible: true, infoboardVisible: true };

    expect(getEffectiveTeamSeasonVisibility(existingTeamSeason, existingTeam)).toEqual({
      websiteVisible: true,
      infoboardVisible: true,
    });
  });
});
