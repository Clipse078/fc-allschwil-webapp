import { describe, expect, it } from "vitest";

import {
  buildCanonicalClubLogoIndex,
  collectProviderClubIdsFromEventPolicies,
  pickProviderClubId,
  resolveExternalTeamLogoWithCanonicalFallback,
} from "../canonical-logo-resolution";

const CANONICAL_LOGO = "https://example.test/fc-black-stars.png";

describe("canonical-logo-resolution", () => {
  it("pickProviderClubId returns the first positive providerClubId", () => {
    expect(
      pickProviderClubId([
        { providerClubId: null },
        { providerClubId: 483 },
      ]),
    ).toBe(483);
  });

  it("buildCanonicalClubLogoIndex maps providerClubId to resolved club logo", () => {
    const index = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
    ]);
    expect(index.get(483)).toBe(CANONICAL_LOGO);
  });

  it("FC Black Stars D7A resolves canonical Verein logo without team-level duplicate", () => {
    const index = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
    ]);

    const logoUrl = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: { logoUrl: null },
        directClub: { logoUrl: null },
        providerMappings: [{ providerClubId: 483 }],
      },
      index,
    );

    expect(logoUrl).toBe(CANONICAL_LOGO);
  });

  it("FC Black Stars B resolves the same canonical crest as D7A", () => {
    const index = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
    ]);

    const d7a = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: { logoUrl: null },
        directClub: { logoUrl: null },
        providerMappings: [{ providerClubId: 483 }],
      },
      index,
    );
    const bTeam = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: { logoUrl: null },
        directClub: { logoUrl: null },
        providerMappings: [{ providerClubId: 483 }],
      },
      index,
    );

    expect(d7a).toBe(CANONICAL_LOGO);
    expect(bTeam).toBe(CANONICAL_LOGO);
  });

  it("unrelated external club resolves its own crest", () => {
    const index = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: CANONICAL_LOGO } },
      { providerClubId: 999, externalClub: { logoUrl: "https://example.test/other.png" } },
    ]);

    const logoUrl = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: { logoUrl: null },
        directClub: { logoUrl: null },
        providerMappings: [{ providerClubId: 999 }],
      },
      index,
    );

    expect(logoUrl).toBe("https://example.test/other.png");
  });

  it("club without logo still returns null for initials fallback", () => {
    const index = buildCanonicalClubLogoIndex([
      { providerClubId: 483, externalClub: { logoUrl: null } },
    ]);

    const logoUrl = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: { logoUrl: null },
        directClub: { logoUrl: null },
        providerMappings: [{ providerClubId: 483 }],
      },
      index,
    );

    expect(logoUrl).toBeNull();
  });

  it("collectProviderClubIdsFromEventPolicies gathers ids from both external sides", () => {
    const ids = collectProviderClubIdsFromEventPolicies([
      {
        matchExternalMapping: {
          homeExternalTeam: {
            providerMappings: [{ providerClubId: 100 }],
          },
          awayExternalTeam: {
            providerMappings: [{ providerClubId: 483 }],
          },
        },
      },
    ]);

    expect(ids).toEqual([100, 483]);
  });
});
