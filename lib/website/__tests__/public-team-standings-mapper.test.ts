import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SportingStandingsTable } from "@/lib/sporting-data/standings-types";
import { mapPublicTeamStandings } from "../public-team-standings-mapper";

const TABLE: SportingStandingsTable = {
  competition: {
    name: "Junioren B",
    divisionName: "Division 1",
    groupName: "Gruppe A",
  },
  rows: [
    {
      position: 1,
      externalTeamId: 200,
      teamName: "Opponent FC",
      shortName: null,
      played: 10,
      won: 8,
      drawn: 1,
      lost: 1,
      goalsFor: 30,
      goalsAgainst: 10,
      points: 25,
      penaltyPoints: 0,
    },
    {
      position: 2,
      externalTeamId: 100,
      teamName: "Own Team",
      shortName: null,
      played: 10,
      won: 7,
      drawn: 2,
      lost: 1,
      goalsFor: 25,
      goalsAgainst: 8,
      points: 23,
      penaltyPoints: 1,
    },
  ],
};

describe("mapPublicTeamStandings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps stats and derives goalDifference", () => {
    const mapped = mapPublicTeamStandings(TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "Own Team",
      currentTeamShortName: "OWN",
      tenantLogoUrl: "https://cdn.example.com/tenant.png",
      enrichmentByProviderTeamId: new Map([
        [
          200,
          {
            canonicalClubId: "club-opponent",
            shortName: "OPP",
            logoUrl: "https://cdn.example.com/opponent.png",
            resolutionSource: "exact_name_match",
            providerTeamName: null,
          },
        ],
      ]),
    });

    const currentRow = mapped.rows.find((row) => row.team.isCurrentTeam);
    expect(currentRow).toMatchObject({
      position: 2,
      played: 10,
      won: 7,
      drawn: 2,
      lost: 1,
      goalsFor: 25,
      goalsAgainst: 8,
      goalDifference: 17,
      points: 23,
      penaltyPoints: 1,
    });
  });

  it("marks only the current team row", () => {
    const mapped = mapPublicTeamStandings(TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "Own Team",
      currentTeamShortName: "OWN",
      tenantLogoUrl: null,
      enrichmentByProviderTeamId: new Map(),
    });

    expect(mapped.rows.filter((row) => row.team.isCurrentTeam)).toHaveLength(1);
    expect(mapped.rows.find((row) => row.team.isCurrentTeam)?.team.name).toBe(
      "Own Team",
    );
  });

  it("uses tenant logo for the current team", () => {
    const mapped = mapPublicTeamStandings(TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "Own Team",
      currentTeamShortName: "OWN",
      tenantLogoUrl: "https://cdn.example.com/tenant.png",
      enrichmentByProviderTeamId: new Map(),
    });

    expect(
      mapped.rows.find((row) => row.team.isCurrentTeam)?.team.logoUrl,
    ).toBe("https://cdn.example.com/tenant.png");
  });

  it("reuses canonical enrichment for opponents", () => {
    const mapped = mapPublicTeamStandings(TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "Own Team",
      currentTeamShortName: "OWN",
      tenantLogoUrl: "https://cdn.example.com/tenant.png",
      enrichmentByProviderTeamId: new Map([
        [
          200,
          {
            canonicalClubId: "club-opponent",
            shortName: "OPP",
            logoUrl: "https://cdn.example.com/opponent.png",
            resolutionSource: "exact_name_match",
            providerTeamName: null,
          },
        ],
      ]),
    });

    const opponent = mapped.rows.find((row) => !row.team.isCurrentTeam);

    expect(opponent?.team.logoUrl).toBe("https://cdn.example.com/opponent.png");
    expect(opponent?.team.shortName).toBe("OPP");
  });

  it("returns null logo when enrichment is unavailable", () => {
    const mapped = mapPublicTeamStandings(TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "Own Team",
      currentTeamShortName: null,
      tenantLogoUrl: null,
      enrichmentByProviderTeamId: new Map(),
    });

    expect(mapped.rows.every((row) => row.team.logoUrl === null)).toBe(true);
  });
});
