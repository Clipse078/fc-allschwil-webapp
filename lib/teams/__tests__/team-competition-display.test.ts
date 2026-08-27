import { describe, expect, it } from "vitest";

import {
  formatTeamCompetitionDisplayLabel,
  resolveCurrentSeasonSfvMapping,
  resolveTeamCompetitionDisplay,
} from "../team-competition-display";

describe("TEAM-COCKPIT-PREMIUM-01C — resolveTeamCompetitionDisplay", () => {
  it("A — standings competition context wins when available", () => {
    const result = resolveTeamCompetitionDisplay({
      standingsCompetition: {
        name: "2. Liga interregional",
        divisionName: "Gruppe 3",
        groupName: null,
      },
      providerLeagueName: "Provider League",
      canonicalCompetition: { name: "Canonical League", shortName: "CL" },
    });

    expect(result).toEqual({
      name: "2. Liga interregional",
      divisionName: "Gruppe 3",
      groupName: null,
      source: "STANDINGS",
    });
  });

  it("B — providerLeagueName wins when standings are unavailable", () => {
    const result = resolveTeamCompetitionDisplay({
      standingsCompetition: null,
      providerLeagueName: "2. Liga interregional",
      canonicalCompetition: { name: "Canonical League", shortName: "CL" },
    });

    expect(result).toEqual({
      name: "2. Liga interregional",
      source: "PROVIDER_MAPPING",
    });
  });

  it("C — canonical TeamSeasonCompetition wins when no standings/provider metadata", () => {
    const result = resolveTeamCompetitionDisplay({
      standingsCompetition: null,
      providerLeagueName: null,
      canonicalCompetition: { name: "3. Liga", shortName: "3L" },
    });

    expect(result).toEqual({
      name: "3. Liga",
      shortName: "3L",
      source: "CANONICAL_COMPETITION",
    });
  });

  it("D — returns null when no source is available", () => {
    expect(
      resolveTeamCompetitionDisplay({
        standingsCompetition: null,
        providerLeagueName: null,
        canonicalCompetition: null,
      }),
    ).toBeNull();
  });

  it("F — provider failure does not remove providerLeagueName fallback", () => {
    const result = resolveTeamCompetitionDisplay({
      standingsCompetition: null,
      providerLeagueName: "2. Liga interregional",
      canonicalCompetition: null,
    });

    expect(result?.name).toBe("2. Liga interregional");
    expect(result?.source).toBe("PROVIDER_MAPPING");
  });

  it("formats display label from shortName when present", () => {
    expect(
      formatTeamCompetitionDisplayLabel({
        name: "2. Liga interregional",
        shortName: "2LI",
        source: "PROVIDER_MAPPING",
      }),
    ).toBe("2LI");
  });
});

describe("TEAM-COCKPIT-PREMIUM-01C — resolveCurrentSeasonSfvMapping", () => {
  const mapping = {
    provider: "SFV",
    teamSeasonId: "ts-current",
    externalTeamId: 123,
    externalSeasonId: 2027,
    providerLeagueId: 10,
    providerLeagueName: "2. Liga interregional",
  };

  it("E — rejects old-season mapping for a different TeamSeason", () => {
    expect(
      resolveCurrentSeasonSfvMapping(mapping, {
        teamSeasonId: "ts-other",
        seasonKey: "2026-2027",
      }),
    ).toBeNull();
  });

  it("E — rejects mapping whose externalSeasonId does not align with season key", () => {
    expect(
      resolveCurrentSeasonSfvMapping(mapping, {
        teamSeasonId: "ts-current",
        seasonKey: "2024-2025",
      }),
    ).toBeNull();
  });

  it("accepts season-aligned current-season mapping", () => {
    expect(
      resolveCurrentSeasonSfvMapping(mapping, {
        teamSeasonId: "ts-current",
        seasonKey: "2026-2027",
      }),
    ).toEqual(mapping);
  });
});
