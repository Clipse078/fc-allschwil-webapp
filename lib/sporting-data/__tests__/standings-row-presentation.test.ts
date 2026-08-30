import { describe, expect, it } from "vitest";

import type { StandingsClubEnrichment } from "@/lib/club-directory/standings-club-enrichment";
import { mapPublicTeamStandings } from "@/lib/website/public-team-standings-mapper";
import { presentStandingsRows } from "../standings-row-presentation";
import type { SportingStandingsTable } from "../standings-types";

const TENANT_LOGO = "https://cdn.example.com/fc-allschwil.png";

const FF14_TABLE: SportingStandingsTable = {
  competition: {
    name: "Juniorinnen FF-14",
    divisionName: null,
    groupName: "9v9",
  },
  rows: [
    {
      position: 1,
      externalTeamId: 501,
      teamName: "Basel Internationaler FC",
      shortName: null,
      played: 8,
      won: 7,
      drawn: 1,
      lost: 0,
      goalsFor: 30,
      goalsAgainst: 5,
      points: 22,
      penaltyPoints: 0,
    },
    {
      position: 2,
      externalTeamId: 502,
      teamName: "SV Muttenz",
      shortName: null,
      played: 8,
      won: 6,
      drawn: 1,
      lost: 1,
      goalsFor: 24,
      goalsAgainst: 10,
      points: 19,
      penaltyPoints: 0,
    },
    {
      position: 3,
      externalTeamId: 503,
      teamName: "FC Arlesheim",
      shortName: null,
      played: 8,
      won: 5,
      drawn: 2,
      lost: 1,
      goalsFor: 20,
      goalsAgainst: 12,
      points: 17,
      penaltyPoints: 0,
    },
    {
      position: 4,
      externalTeamId: 504,
      teamName: "FC Nordstern BS FF14_9",
      shortName: null,
      played: 8,
      won: 4,
      drawn: 2,
      lost: 2,
      goalsFor: 18,
      goalsAgainst: 14,
      points: 14,
      penaltyPoints: 0,
    },
    {
      position: 5,
      externalTeamId: 100,
      teamName: "FC Allschwil Juniorinnen FF-14",
      shortName: null,
      played: 8,
      won: 3,
      drawn: 2,
      lost: 3,
      goalsFor: 15,
      goalsAgainst: 16,
      points: 11,
      penaltyPoints: 0,
    },
  ],
};

function buildFf14Enrichment(): Map<number, StandingsClubEnrichment> {
  return new Map([
    [
      501,
      {
        canonicalClubId: "club-bifc",
        shortName: "BIFC",
        logoUrl: "https://cdn.example.com/basel-internationaler-fc.png",
        resolutionSource: "prefix_name_match",
      },
    ],
    [
      502,
      {
        canonicalClubId: "club-muttenz",
        shortName: "Muttenz",
        logoUrl: "https://cdn.example.com/sv-muttenz.png",
        resolutionSource: "exact_name_match",
      },
    ],
    [
      503,
      {
        canonicalClubId: "club-arlesheim",
        shortName: "Arlesheim",
        logoUrl: "https://cdn.example.com/fc-arlesheim.png",
        resolutionSource: "exact_name_match",
      },
    ],
    [
      504,
      {
        canonicalClubId: "club-nordstern",
        shortName: "Nordstern",
        logoUrl: "https://cdn.example.com/fc-nordstern.png",
        resolutionSource: "prefix_name_match",
      },
    ],
  ]);
}

describe("presentStandingsRows", () => {
  it("exposes canonical logos for Juniorinnen FF-14 opponents while preserving provider names", () => {
    const enrichment = buildFf14Enrichment();
    const rows = presentStandingsRows({
      rows: FF14_TABLE.rows,
      currentExternalTeamId: 100,
      currentTeamShortName: "FF-14",
      tenantLogoUrl: TENANT_LOGO,
      enrichmentByProviderTeamId: enrichment,
    });

    expect(rows.find((row) => row.teamName === "Basel Internationaler FC")).toMatchObject({
      logoUrl: "https://cdn.example.com/basel-internationaler-fc.png",
      shortName: "BIFC",
      teamName: "Basel Internationaler FC",
    });
    expect(rows.find((row) => row.teamName === "SV Muttenz")).toMatchObject({
      logoUrl: "https://cdn.example.com/sv-muttenz.png",
      teamName: "SV Muttenz",
    });
    expect(rows.find((row) => row.teamName === "FC Arlesheim")).toMatchObject({
      logoUrl: "https://cdn.example.com/fc-arlesheim.png",
      teamName: "FC Arlesheim",
    });
    expect(rows.find((row) => row.teamName === "FC Nordstern BS FF14_9")).toMatchObject({
      logoUrl: "https://cdn.example.com/fc-nordstern.png",
      teamName: "FC Nordstern BS FF14_9",
    });
    expect(rows.find((row) => row.isCurrentTeam)?.logoUrl).toBe(TENANT_LOGO);
  });
});

describe("cockpit/public standings logo parity", () => {
  it("returns identical logoUrl results for the same enrichment input", () => {
    const enrichment = buildFf14Enrichment();
    const sharedInput = {
      rows: FF14_TABLE.rows,
      currentExternalTeamId: 100,
      currentTeamShortName: "FF-14",
      tenantLogoUrl: TENANT_LOGO,
      enrichmentByProviderTeamId: enrichment,
    };

    const cockpitRows = presentStandingsRows(sharedInput);
    const publicRows = mapPublicTeamStandings(FF14_TABLE, {
      currentExternalTeamId: 100,
      currentTeamName: "FC Allschwil Juniorinnen FF-14",
      currentTeamShortName: "FF-14",
      tenantLogoUrl: TENANT_LOGO,
      enrichmentByProviderTeamId: enrichment,
    }).rows;

    expect(publicRows.map((row) => row.team.logoUrl)).toEqual(
      cockpitRows.map((row) => row.logoUrl),
    );
    expect(publicRows.map((row) => row.team.name)).toEqual(
      cockpitRows.map((row) => row.teamName),
    );
  });

  it("preserves representative provider qualifiers with identical canonical logos", () => {
    const representatives = [
      ["FC Black Stars D7a", "black-stars"],
      ["FC Amicitia Riehen D7a", "amicitia-riehen"],
      ["SV Muttenz Scorpions", "muttenz"],
      ["FC Aesch D7-1", "aesch"],
      ["FC Nordstern BS D7 weiss", "nordstern"],
      ["Basel Internationaler FC", "basel-international"],
    ] as const;
    const rows = representatives.map(([teamName], index) => ({
      position: index + 1,
      externalTeamId: index + 200,
      teamName,
      shortName: null,
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      goalsFor: 0,
      goalsAgainst: 1,
      points: 0,
      penaltyPoints: 0,
    }));
    const table: SportingStandingsTable = {
      competition: {
        name: "Junioren D-7",
        divisionName: null,
        groupName: "Gruppe 1",
      },
      rows,
    };
    const enrichment = new Map<number, StandingsClubEnrichment>(
      representatives.map(([, clubKey], index) => [
        index + 200,
        {
          canonicalClubId: `club-${clubKey}`,
          shortName: null,
          logoUrl: `https://cdn.example.com/${clubKey}.png`,
          resolutionSource:
            clubKey === "basel-international"
              ? "exact_name_match"
              : "prefix_name_match",
        },
      ]),
    );
    const sharedInput = {
      rows,
      currentExternalTeamId: 100,
      currentTeamShortName: "FCA",
      tenantLogoUrl: TENANT_LOGO,
      enrichmentByProviderTeamId: enrichment,
    };

    const cockpitRows = presentStandingsRows(sharedInput);
    const publicRows = mapPublicTeamStandings(table, {
      currentExternalTeamId: 100,
      currentTeamName: "FC Allschwil",
      currentTeamShortName: "FCA",
      tenantLogoUrl: TENANT_LOGO,
      enrichmentByProviderTeamId: enrichment,
    }).rows;

    expect(publicRows.map((row) => row.team.name)).toEqual(
      representatives.map(([providerName]) => providerName),
    );
    expect(publicRows.map((row) => row.team.logoUrl)).toEqual(
      cockpitRows.map((row) => row.logoUrl),
    );
  });
});
