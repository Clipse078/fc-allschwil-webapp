/**
 * lib/publishing/presentation/__tests__/infoboard-match-presentation.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  enrichMatchIdentityWithTenant,
  resolveInfoboardClubDisplayName,
  resolveInfoboardMatchPresentation,
  resolveInfoboardTeamSubDisplayName,
  type InfoboardMatchIdentity,
} from "../infoboard-match-presentation";

function makeIdentity(
  overrides: Partial<InfoboardMatchIdentity> = {},
): InfoboardMatchIdentity {
  return {
    home: {
      isOwnTeam: true,
      clubName: null,
      clubLogoUrl: null,
      teamName: "FC Allschwil Junioren C2",
      teamShortName: null,
      teamAlternativeName: "Junioren C2",
      teamInfoboardDisplayName: null,
      teamInfoboardMatchDisplayName: null,
      fallbackDisplayName: "FC Allschwil Junioren C2",
    },
    away: {
      isOwnTeam: false,
      clubName: "FC Therwil",
      clubLogoUrl: "https://cdn.example.com/therwil.png",
      teamName: "FC Therwil C Gelb",
      teamShortName: "C Gelb",
      teamAlternativeName: null,
      teamInfoboardDisplayName: null,
      teamInfoboardMatchDisplayName: null,
      fallbackDisplayName: "FC Therwil C Gelb",
    },
    ...overrides,
  };
}

describe("resolveInfoboardClubDisplayName", () => {
  it("prefers canonical club name over fallback", () => {
    expect(
      resolveInfoboardClubDisplayName("FC Allschwil", "FC Allschwil Junioren C2"),
    ).toBe("FC Allschwil");
  });

  it("falls back to combined display name when club name is absent", () => {
    expect(resolveInfoboardClubDisplayName(null, "FC Binningen E1")).toBe(
      "FC Binningen E1",
    );
  });
});

describe("resolveInfoboardTeamSubDisplayName", () => {
  it("uses infoboardMatchDisplayName before generic infoboardDisplayName", () => {
    expect(
      resolveInfoboardTeamSubDisplayName({
        clubDisplayName: "FC Allschwil",
        teamName: "FC Allschwil Junioren E1",
        teamShortName: "E1",
        teamAlternativeName: "Junioren E1",
        teamInfoboardDisplayName: "FCA E1",
        teamInfoboardMatchDisplayName: "FC Allschwil E1",
      }),
    ).toBe("FC Allschwil E1");
  });

  it("uses infoboardDisplayName first", () => {
    expect(
      resolveInfoboardTeamSubDisplayName({
        clubDisplayName: "FC Allschwil",
        teamName: "E4",
        teamShortName: "E4",
        teamAlternativeName: "Junioren E4",
        teamInfoboardDisplayName: "JUNIOREN E4",
      }),
    ).toBe("JUNIOREN E4");
  });

  it("uses alternativeName when infoboardDisplayName is absent", () => {
    expect(
      resolveInfoboardTeamSubDisplayName({
        clubDisplayName: "FC Allschwil",
        teamName: "FC Allschwil Junioren C2",
        teamShortName: "C2",
        teamAlternativeName: "Junioren C2",
      }),
    ).toBe("Junioren C2");
  });

  it("uses shortName when alternativeName is absent", () => {
    expect(
      resolveInfoboardTeamSubDisplayName({
        clubDisplayName: "FC Therwil",
        teamName: "FC Therwil C Gelb",
        teamShortName: "C Gelb",
        teamAlternativeName: null,
      }),
    ).toBe("C Gelb");
  });

  it("strips club prefix from long team name fallback", () => {
    expect(
      resolveInfoboardTeamSubDisplayName({
        clubDisplayName: "FC Allschwil",
        teamName: "FC Allschwil Junioren C2",
        teamShortName: null,
        teamAlternativeName: null,
      }),
    ).toBe("Junioren C2");
  });
});

describe("resolveInfoboardMatchPresentation", () => {
  it("12 — own-team Match pipeline uses infoboardMatchDisplayName", () => {
    const result = resolveInfoboardMatchPresentation(
      makeIdentity({
        home: {
          isOwnTeam: true,
          clubName: null,
          clubLogoUrl: null,
          teamName: "FC Allschwil Junioren E1",
          teamShortName: "E1",
          teamAlternativeName: "Junioren E1",
          teamInfoboardDisplayName: "FCA E1",
          teamInfoboardMatchDisplayName: "FC Allschwil E1",
          fallbackDisplayName: "FC Allschwil Junioren E1",
        },
      }),
      "https://cdn.example.com/tenant.png",
      "FC Allschwil",
    );

    expect(result?.home.teamSubDisplayName).toBe("FC Allschwil E1");
  });

  it("13 — external opponent remains unchanged", () => {
    const result = resolveInfoboardMatchPresentation(
      makeIdentity(),
      "https://cdn.example.com/tenant.png",
      "FC Allschwil",
    );

    expect(result?.away?.teamSubDisplayName).toBe("C Gelb");
  });

  it("resolves tenant logo for own-team side and external logo for opponent", () => {
    const result = resolveInfoboardMatchPresentation(
      makeIdentity(),
      "https://cdn.example.com/tenant.png",
      "FC Allschwil",
    );

    expect(result?.home.clubDisplayName).toBe("FC Allschwil");
    expect(result?.home.teamSubDisplayName).toBe("Junioren C2");
    expect(result?.home.clubLogoUrl).toBe("https://cdn.example.com/tenant.png");
    expect(result?.away?.clubDisplayName).toBe("FC Therwil");
    expect(result?.away?.teamSubDisplayName).toBe("C Gelb");
    expect(result?.away?.clubLogoUrl).toBe("https://cdn.example.com/therwil.png");
  });

  it("returns null when identity is absent", () => {
    expect(resolveInfoboardMatchPresentation(null, null, "FC Allschwil")).toBeNull();
  });

  it("handles missing logos gracefully", () => {
    const result = resolveInfoboardMatchPresentation(
      makeIdentity({
        away: {
          isOwnTeam: false,
          clubName: "FC Therwil",
          clubLogoUrl: null,
          teamName: "C Gelb",
          teamShortName: "C Gelb",
          teamAlternativeName: null,
          teamInfoboardDisplayName: null,
          teamInfoboardMatchDisplayName: null,
          fallbackDisplayName: "FC Therwil C Gelb",
        },
      }),
      null,
      "FC Allschwil",
    );

    expect(result?.home.clubLogoUrl).toBeNull();
    expect(result?.away?.clubLogoUrl).toBeNull();
  });
});

describe("enrichMatchIdentityWithTenant", () => {
  it("fills tenant club name only for own-team sides", () => {
    const enriched = enrichMatchIdentityWithTenant(makeIdentity(), "FC Allschwil");
    expect(enriched.home.clubName).toBe("FC Allschwil");
    expect(enriched.away?.clubName).toBe("FC Therwil");
  });
});
