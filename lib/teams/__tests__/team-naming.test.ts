/**
 * lib/teams/__tests__/team-naming.test.ts
 *
 * TEAM-IDENTITY-01 — Unit tests for the canonical Team naming contract.
 *
 * Pure functions only. No database or network access.
 *
 * TEAMCENTER-UX-01B: Team.name is the canonical, tenant-managed Team
 * identity and must be the PRIMARY value in long/detail contexts. A
 * seasonal TeamSeason.displayName override (or any provider/SFV name) must
 * never substitute for it while Team.name is present — see test 1 and the
 * "root-cause regression" describe block below.
 *
 * TEST COVERAGE MAP:
 *   resolveLongTeamName
 *     1.  Prefers Team.name over a conflicting TeamSeason.displayName.
 *     2.  Falls back to TeamSeason.displayName only when Team.name is absent.
 *     3.  Falls back to Team.alternativeName when name is absent.
 *     4.  Falls back to providerTeamName as the last resort.
 *     5.  Returns null when every candidate is absent (TENANT_NAMING_REQUIRED case).
 *     6.  Treats whitespace-only strings as absent.
 *
 *   resolveCompactTeamName
 *     7.  Prefers Team.shortName over Team.name (compact fallback prefers shortName).
 *     8.  Falls back to Team.name when shortName is absent/optional.
 *     9.  Falls back to Team.alternativeName when name and shortName are absent.
 *     10. Falls back to providerTeamName as the last resort.
 *     11. Returns null when every candidate is absent.
 *
 *   manual vs. provider-connected teams
 *     12. A manual team (no providerTeamName) resolves purely from tenant fields.
 *     13. A provider-connected team still prefers tenant fields over providerTeamName.
 */

import { describe, it, expect } from "vitest";
import { resolveLongTeamName, resolveCompactTeamName } from "../team-naming";

describe("resolveLongTeamName", () => {
  it("1 — prefers Team.name over a conflicting TeamSeason.displayName (TEAMCENTER-UX-01B root cause)", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: "Junioren B2",
        teamName: "FC Allschwil Junioren B2",
        teamAlternativeName: "B2 Team",
        providerTeamName: "Provider Name",
      }),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("2 — falls back to TeamSeason.displayName only when Team.name is absent", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: "FC Allschwil Junioren B2",
        teamName: null,
        teamAlternativeName: "Junioren B2",
        providerTeamName: "Provider Name",
      }),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("3 — falls back to Team.alternativeName when name is absent", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: null,
        teamName: null,
        teamAlternativeName: "Junioren B2",
        providerTeamName: "Provider Name",
      }),
    ).toBe("Junioren B2");
  });

  it("4 — falls back to providerTeamName as the last resort", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: null,
        teamName: null,
        teamAlternativeName: null,
        providerTeamName: "SFV Provider Name",
      }),
    ).toBe("SFV Provider Name");
  });

  it("5 — returns null when every candidate is absent (TENANT_NAMING_REQUIRED)", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: null,
        teamName: null,
        teamAlternativeName: null,
        providerTeamName: null,
      }),
    ).toBeNull();
  });

  it("6 — treats whitespace-only strings as absent", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: "   ",
        teamName: "FC Allschwil Junioren B2",
      }),
    ).toBe("FC Allschwil Junioren B2");
  });
});

describe("resolveCompactTeamName", () => {
  it("7 — prefers Team.shortName over Team.name (compact fallback prefers shortName)", () => {
    expect(
      resolveCompactTeamName({
        teamShortName: "B2",
        teamName: "FC Allschwil Junioren B2",
        teamAlternativeName: "Junioren B2",
        providerTeamName: "Provider Name",
      }),
    ).toBe("B2");
  });

  it("8 — falls back to Team.name when shortName is absent (shortName optional)", () => {
    expect(
      resolveCompactTeamName({
        teamShortName: null,
        teamName: "FC Allschwil Junioren B2",
        teamAlternativeName: "Junioren B2",
        providerTeamName: "Provider Name",
      }),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("9 — falls back to Team.alternativeName when name and shortName are absent", () => {
    expect(
      resolveCompactTeamName({
        teamShortName: null,
        teamName: null,
        teamAlternativeName: "Junioren B2",
        providerTeamName: "Provider Name",
      }),
    ).toBe("Junioren B2");
  });

  it("10 — falls back to providerTeamName as the last resort", () => {
    expect(
      resolveCompactTeamName({
        teamShortName: null,
        teamName: null,
        teamAlternativeName: null,
        providerTeamName: "SFV Provider Name",
      }),
    ).toBe("SFV Provider Name");
  });

  it("11 — returns null when every candidate is absent", () => {
    expect(
      resolveCompactTeamName({
        teamShortName: null,
        teamName: null,
        teamAlternativeName: null,
        providerTeamName: null,
      }),
    ).toBeNull();
  });
});

describe("manual vs. provider-connected teams", () => {
  it("12 — a manual team (no providerTeamName) resolves purely from tenant fields", () => {
    expect(
      resolveLongTeamName({
        teamName: "Trainingsgruppe Aktive",
        providerTeamName: null,
      }),
    ).toBe("Trainingsgruppe Aktive");

    expect(
      resolveCompactTeamName({
        teamShortName: "TG",
        providerTeamName: null,
      }),
    ).toBe("TG");
  });

  it("13 — a provider-connected team still prefers tenant fields over providerTeamName", () => {
    expect(
      resolveLongTeamName({
        teamName: "FC Allschwil Junioren B2",
        providerTeamName: "FC Allschwil Junioren B2 (4. Liga)",
      }),
    ).toBe("FC Allschwil Junioren B2");

    expect(
      resolveCompactTeamName({
        teamShortName: "B2",
        providerTeamName: "FC Allschwil Junioren B2 (4. Liga)",
      }),
    ).toBe("B2");
  });
});

// ── TEAMCENTER-UX-01B — STAGE naming-inconsistency root-cause regression ─────
//
// Reproduces the exact STAGE symptom: Team detail showed "FC Allschwil
// Junioren E1"/"E3" (Team.name) while the Teams overview showed a different,
// shorter or mismatched value ("Junioren E1" / "FC Allschwil Junioren E2")
// sourced from TeamSeason.displayName or provider data. Both surfaces call
// resolveLongTeamName with the same input shape, so this test guarantees
// they can never diverge again.
describe("TEAMCENTER-UX-01B — root-cause regression: Team.name must win", () => {
  it("Team.name = 'FC Allschwil Junioren E3' wins over a stale TeamSeason.displayName of 'FC Allschwil Junioren E2'", () => {
    expect(
      resolveLongTeamName({
        teamName: "FC Allschwil Junioren E3",
        teamSeasonDisplayName: "FC Allschwil Junioren E2",
        teamShortName: "E3",
        teamAlternativeName: "Junioren E3",
        providerTeamName: "FC Allschwil Junioren E2 (SFV)",
      }),
    ).toBe("FC Allschwil Junioren E3");
  });

  it("Team.name = 'FC Allschwil Junioren E1' wins over a truncated TeamSeason.displayName of 'Junioren E1'", () => {
    expect(
      resolveLongTeamName({
        teamName: "FC Allschwil Junioren E1",
        teamSeasonDisplayName: "Junioren E1",
      }),
    ).toBe("FC Allschwil Junioren E1");
  });
});
