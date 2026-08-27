import { describe, expect, it } from "vitest";

import {
  getExternalClubLogoKey,
  getExternalTeamLogoKey,
  getNormalizedProviderClubLogoKey,
  getTenantLogoKey,
} from "../tenant-paths";

describe("getTenantLogoKey", () => {
  it("builds the tenant-scoped logo key", () => {
    expect(getTenantLogoKey("fc-allschwil", "png")).toBe("logos/fc-allschwil.png");
  });
});

describe("CLUB-DIRECTORY-01 crest key builders", () => {
  it("builds a tenant- and club-scoped key for an ExternalClub crest", () => {
    expect(getExternalClubLogoKey("fc-allschwil", "club-1", "png")).toBe(
      "clubs/fc-allschwil/club-1.png",
    );
  });

  it("builds a tenant- and team-scoped key for an ExternalTeam crest override", () => {
    expect(getExternalTeamLogoKey("fc-allschwil", "team-1", "webp")).toBe(
      "clubs/fc-allschwil/teams/team-1.webp",
    );
  });

  it("produces distinct keys for different clubs in the same tenant", () => {
    const keyA = getExternalClubLogoKey("fc-allschwil", "club-1", "png");
    const keyB = getExternalClubLogoKey("fc-allschwil", "club-2", "png");
    expect(keyA).not.toBe(keyB);
  });

  it("produces distinct keys for the same club id across different tenants (tenant isolation in storage)", () => {
    const keyA = getExternalClubLogoKey("fc-allschwil", "club-1", "png");
    const keyB = getExternalClubLogoKey("sv-muttenz", "club-1", "png");
    expect(keyA).not.toBe(keyB);
  });
});

describe("MEDIA-LOGO-01B normalized provider crest keys", () => {
  it("builds a provider-club-scoped normalized PNG key", () => {
    expect(
      getNormalizedProviderClubLogoKey("fc-allschwil", { provider: "SFV", providerClubId: 483 }),
    ).toBe("clubs/fc-allschwil/provider/sfv/483.png");
  });

  it("builds an external-club-scoped normalized PNG key", () => {
    expect(getNormalizedProviderClubLogoKey("fc-allschwil", { externalClubId: "club-1" })).toBe(
      "clubs/fc-allschwil/club-1.png",
    );
  });
});
