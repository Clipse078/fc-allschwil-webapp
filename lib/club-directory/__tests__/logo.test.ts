import { describe, expect, it } from "vitest";

import {
  mergeProviderLogoUrl,
  resolveExternalClubLogoUrl,
  resolveExternalTeamLogoUrl,
} from "../logo";

describe("resolveExternalTeamLogoUrl", () => {
  it("prefers the team-level logo override when set", () => {
    expect(
      resolveExternalTeamLogoUrl(
        { logoUrl: "https://cdn.example.com/team.png" },
        { logoUrl: "https://cdn.example.com/club.png" },
      ),
    ).toBe("https://cdn.example.com/team.png");
  });

  it("falls back to the club logo when the team has no override", () => {
    expect(
      resolveExternalTeamLogoUrl(
        { logoUrl: null },
        { logoUrl: "https://cdn.example.com/club.png" },
      ),
    ).toBe("https://cdn.example.com/club.png");
  });

  it("returns null (clean placeholder) when neither team nor club has a logo", () => {
    expect(resolveExternalTeamLogoUrl({ logoUrl: null }, { logoUrl: null })).toBeNull();
  });

  it("treats a blank/whitespace-only team logo as unset", () => {
    expect(
      resolveExternalTeamLogoUrl(
        { logoUrl: "   " },
        { logoUrl: "https://cdn.example.com/club.png" },
      ),
    ).toBe("https://cdn.example.com/club.png");
  });

  it("treats undefined the same as null", () => {
    expect(
      resolveExternalTeamLogoUrl({ logoUrl: undefined }, { logoUrl: undefined }),
    ).toBeNull();
  });
});

describe("resolveExternalClubLogoUrl", () => {
  it("returns the club logo when set", () => {
    expect(resolveExternalClubLogoUrl({ logoUrl: "https://cdn.example.com/club.png" })).toBe(
      "https://cdn.example.com/club.png",
    );
  });

  it("returns null when unset", () => {
    expect(resolveExternalClubLogoUrl({ logoUrl: null })).toBeNull();
  });
});

describe("mergeProviderLogoUrl — tenant-managed field ownership", () => {
  it("keeps the tenant-managed logo untouched when one already exists", () => {
    expect(
      mergeProviderLogoUrl(
        "https://blob.example.com/tenant-logo.png",
        "https://sfv.example.com/provider-logo.gif",
      ),
    ).toBe("https://blob.example.com/tenant-logo.png");
  });

  it("fills the logo from the provider when none is set yet", () => {
    expect(mergeProviderLogoUrl(null, "https://sfv.example.com/provider-logo.gif")).toBe(
      "https://sfv.example.com/provider-logo.gif",
    );
  });

  it("returns null when neither the tenant nor the provider has a logo", () => {
    expect(mergeProviderLogoUrl(null, null)).toBeNull();
  });

  it("returns null when the provider logo is blank", () => {
    expect(mergeProviderLogoUrl(null, "   ")).toBeNull();
  });

  it("never lets a provider value overwrite an existing tenant value, even repeatedly", () => {
    let current: string | null = null;
    current = mergeProviderLogoUrl(current, "https://sfv.example.com/v1.gif");
    expect(current).toBe("https://sfv.example.com/v1.gif");

    // A later sync reports a different provider logo — must not change the
    // now-established value.
    current = mergeProviderLogoUrl(current, "https://sfv.example.com/v2.gif");
    expect(current).toBe("https://sfv.example.com/v1.gif");
  });
});
