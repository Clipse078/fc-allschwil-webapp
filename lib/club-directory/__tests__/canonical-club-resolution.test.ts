import { describe, expect, it } from "vitest";

import {
  buildCanonicalClubNameIndexes,
  resolveCanonicalClubFromProviderTeamName,
} from "../canonical-club-resolution";

const BLACK_STARS_LOGO = "https://cdn.example.com/fc-black-stars.png";
const BASEL_NORD_LOGO = "https://cdn.example.com/fc-basel-nord.png";
const BASEL_LOGO = "https://cdn.example.com/fc-basel.png";
const ALLSCHWIL_LOGO = "https://cdn.example.com/fc-allschwil.png";

function buildTestIndexes() {
  return buildCanonicalClubNameIndexes([
    {
      id: "club-allschwil",
      name: "FC Allschwil",
      shortName: null,
      alternativeName: null,
      logoUrl: ALLSCHWIL_LOGO,
    },
    {
      id: "club-black-stars",
      name: "FC Black Stars",
      shortName: null,
      alternativeName: null,
      logoUrl: BLACK_STARS_LOGO,
    },
    {
      id: "club-amicitia",
      name: "FC Amicitia Riehen",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/fc-amicitia.png",
    },
    {
      id: "club-muttenz",
      name: "SV Muttenz",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/sv-muttenz.png",
    },
    {
      id: "club-aesch",
      name: "FC Aesch",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/fc-aesch.png",
    },
    {
      id: "club-nordstern",
      name: "FC Nordstern BS",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/fc-nordstern.png",
    },
    {
      id: "club-bifc",
      name: "Basel Internationaler FC",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/basel-internationaler-fc.png",
    },
    {
      id: "club-basel",
      name: "FC Basel",
      shortName: null,
      alternativeName: null,
      logoUrl: BASEL_LOGO,
    },
    {
      id: "club-basel-nord",
      name: "FC Basel Nord",
      shortName: null,
      alternativeName: null,
      logoUrl: BASEL_NORD_LOGO,
    },
    {
      id: "club-all",
      name: "FC All",
      shortName: null,
      alternativeName: null,
      logoUrl: "https://cdn.example.com/fc-all.png",
    },
  ]);
}

describe("resolveCanonicalClubFromProviderTeamName", () => {
  const indexes = buildTestIndexes();

  it("resolves exact match for FC Allschwil", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Allschwil", indexes),
    ).toMatchObject({
      id: "club-allschwil",
      source: "exact_name_match",
      logoUrl: ALLSCHWIL_LOGO,
    });
  });

  it("resolves FC Black Stars D7a to FC Black Stars", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Black Stars D7a", indexes),
    ).toMatchObject({
      id: "club-black-stars",
      source: "prefix_name_match",
      logoUrl: BLACK_STARS_LOGO,
    });
  });

  it("resolves FC Amicitia Riehen D7a", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Amicitia Riehen D7a", indexes),
    ).toMatchObject({
      id: "club-amicitia",
      source: "prefix_name_match",
    });
  });

  it("resolves SV Muttenz Scorpions", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("SV Muttenz Scorpions", indexes),
    ).toMatchObject({
      id: "club-muttenz",
      source: "prefix_name_match",
    });
  });

  it("resolves FC Aesch D7-1", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Aesch D7-1", indexes),
    ).toMatchObject({
      id: "club-aesch",
      source: "prefix_name_match",
    });
  });

  it("resolves FC Nordstern BS D7 weiss", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Nordstern BS D7 weiss", indexes),
    ).toMatchObject({
      id: "club-nordstern",
      source: "prefix_name_match",
    });
  });

  it("resolves Basel Internationaler FC", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName(
        "Basel Internationaler FC",
        indexes,
      ),
    ).toMatchObject({
      id: "club-bifc",
      source: "exact_name_match",
    });
  });

  it("chooses the longest prefix match for FC Basel Nord D7", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Basel Nord D7", indexes),
    ).toMatchObject({
      id: "club-basel-nord",
      source: "prefix_name_match",
      logoUrl: BASEL_NORD_LOGO,
    });
  });

  it("does not match club names embedded inside unrelated words", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Allschwil", indexes)?.id,
    ).toBe("club-allschwil");
    expect(
      resolveCanonicalClubFromProviderTeamName("FC Allschwil City", indexes)?.id,
    ).not.toBe("club-all");
  });

  it("returns null for unknown provider names", () => {
    expect(
      resolveCanonicalClubFromProviderTeamName("Unknown Club D7", indexes),
    ).toBeNull();
  });

  it("includes providerClubName aliases in the resolution set", () => {
    const aliasIndexes = buildCanonicalClubNameIndexes([
      {
        id: "club-alias",
        name: "Canonical Name",
        shortName: null,
        alternativeName: null,
        logoUrl: "https://cdn.example.com/alias.png",
        providerMappings: [{ providerClubName: "Provider Alias FC" }],
      },
    ]);

    expect(
      resolveCanonicalClubFromProviderTeamName("Provider Alias FC B1", aliasIndexes),
    ).toMatchObject({
      id: "club-alias",
      source: "prefix_name_match",
    });
  });
});
