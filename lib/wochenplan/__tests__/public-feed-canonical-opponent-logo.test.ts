/**
 * WOCHENPLAN-2.0-02F — canonical Verein logo resolution for public weekplan matches.
 */

import { describe, expect, it } from "vitest";

import { buildPublicMatchIdentity } from "../public-feed-mapper";
import type { WeekplannerMatchItem } from "@/lib/weekplanner/types";
import { buildCanonicalClubLogoIndex } from "@/lib/club-directory/canonical-logo-resolution";

const CANONICAL_LOGO = "https://example.test/fc-black-stars.png";
const TENANT_NAME = "FC Allschwil";
const TENANT_LOGO = "https://cdn.example.com/fca.png";

function matchItem(
  overrides: Partial<WeekplannerMatchItem> = {},
): WeekplannerMatchItem {
  return {
    type: "MATCH",
    tenantId: "tenant-fca",
    eventId: "event-1",
    title: "FC Allschwil Junioren D-7 D1 vs FC Black Stars D7A",
    teamNames: ["FC Allschwil Junioren D-7 D1"],
    opponentName: "FC Black Stars D7A",
    startAt: new Date("2026-08-28T17:00:00.000Z"),
    endAt: new Date("2026-08-28T18:30:00.000Z"),
    pitchAllocations: [],
    dressingRoomAllocations: [],
    awayDressingRoomAllocations: [],
    timeOverridden: false,
    pitchOverridden: false,
    ...overrides,
  };
}

function blackStarsAwayPolicy(teamName: string, providerClubId: number) {
  return {
    id: "event-1",
    status: "SCHEDULED",
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: false,
    homeAway: "HOME",
    organizerName: null,
    competitionLabel: null,
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    season: { key: "2026-27" },
    team: {
      id: "team-d7-d1",
      slug: "junioren-d7-d1",
      name: "FC Allschwil Junioren D-7 D1",
      shortName: null,
      alternativeName: null,
      infoboardDisplayName: null,
      infoboardTrainingDisplayName: null,
      infoboardMatchDisplayName: null,
      infoboardTournamentDisplayName: null,
    },
    opponentExternalClub: null,
    matchExternalMapping: {
      homeTeam: {
        id: "team-d7-d1",
        slug: "junioren-d7-d1",
        name: "FC Allschwil Junioren D-7 D1",
        shortName: null,
        alternativeName: null,
        infoboardDisplayName: null,
        infoboardTrainingDisplayName: null,
        infoboardMatchDisplayName: null,
        infoboardTournamentDisplayName: null,
      },
      awayTeam: null,
      homeExternalTeam: null,
      awayExternalTeam: {
        name: teamName,
        shortName: null,
        alternativeName: null,
        logoUrl: null,
        externalClub: {
          name: teamName,
          shortName: null,
          logoUrl: null,
        },
        providerMappings: [{ providerClubId }],
      },
    },
  };
}

const canonicalIndex = buildCanonicalClubLogoIndex([
  { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
]);

describe("public weekplan canonical opponent logo", () => {
  it("FC Black Stars D7A opponent receives canonical Verein logo on away side", () => {
    const identity = buildPublicMatchIdentity(
      blackStarsAwayPolicy("FC Black Stars D7A", 483),
      matchItem({ opponentName: "FC Black Stars D7A" }),
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.home.logoUrl).toBe(TENANT_LOGO);
    expect(identity.away.logoUrl).toBe(CANONICAL_LOGO);
    expect(identity.away.displayName).toBe("FC Black Stars D7A");
  });

  it("FC Black Stars B opponent receives the same canonical crest", () => {
    const identity = buildPublicMatchIdentity(
      blackStarsAwayPolicy("FC Black Stars B", 483),
      matchItem({
        opponentName: "FC Black Stars B",
        title: "FC Allschwil Junioren B2 vs FC Black Stars B",
        teamNames: ["FC Allschwil Junioren B2"],
      }),
      TENANT_NAME,
      TENANT_LOGO,
      canonicalIndex,
    );

    expect(identity.away.logoUrl).toBe(CANONICAL_LOGO);
  });

  it("preserves unrelated club crest resolution", () => {
    const otherIndex = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
      { providerClubId: 700, externalClub: { logoUrl: "https://example.test/other.png" } },
    ]);

    const identity = buildPublicMatchIdentity(
      blackStarsAwayPolicy("SV Muttenz B1", 700),
      matchItem({ opponentName: "SV Muttenz B1" }),
      TENANT_NAME,
      TENANT_LOGO,
      otherIndex,
    );

    expect(identity.away.logoUrl).toBe("https://example.test/other.png");
  });
});
