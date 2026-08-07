/**
 * lib/teams/__tests__/team-naming.test.ts
 *
 * TEAM-IDENTITY-01 — Unit tests for the canonical Team naming contract.
 *
 * Pure functions only. No database or network access.
 *
 * TEST COVERAGE MAP:
 *   resolveLongTeamName
 *     1.  Prefers TeamSeason.displayName when present.
 *     2.  Falls back to Team.name (long name) when no seasonal override exists.
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
  it("1 — prefers TeamSeason.displayName when present", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: "FC Allschwil Junioren B2",
        teamName: "Junioren B2",
        teamAlternativeName: "B2 Team",
        providerTeamName: "Provider Name",
      }),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("2 — falls back to Team.name (long name) when no seasonal override exists", () => {
    expect(
      resolveLongTeamName({
        teamSeasonDisplayName: null,
        teamName: "FC Allschwil Junioren B2",
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
