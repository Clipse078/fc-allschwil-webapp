import { describe, expect, it } from "vitest";

import {
  mergeProviderLogoUrl,
  resolveExternalClubLogoUrl,
  resolveExternalTeamCanonicalLogoUrl,
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

describe("resolveExternalTeamCanonicalLogoUrl", () => {
  const CANONICAL_LOGO = "https://example.test/fc-black-stars.png";

  it("falls back to canonical Verein logo when team and direct club have none", () => {
    expect(
      resolveExternalTeamCanonicalLogoUrl(
        { logoUrl: null },
        { logoUrl: null },
        { logoUrl: CANONICAL_LOGO },
      ),
    ).toBe(CANONICAL_LOGO);
  });

  it("prefers the mapped canonical Verein over a stale direct shell-club logo", () => {
    expect(
      resolveExternalTeamCanonicalLogoUrl(
        { logoUrl: null },
        { logoUrl: "https://cdn.example.com/direct.png" },
        { logoUrl: CANONICAL_LOGO },
      ),
    ).toBe(CANONICAL_LOGO);
  });

  it("uses normalized-name canonical fallback before the direct club logo", () => {
    expect(
      resolveExternalTeamCanonicalLogoUrl(
        { logoUrl: null },
        { logoUrl: "https://cdn.example.com/direct.png" },
        null,
        { logoUrl: CANONICAL_LOGO },
      ),
    ).toBe(CANONICAL_LOGO);
  });

  it("falls back to the direct club when canonical resolution has no logo", () => {
    expect(
      resolveExternalTeamCanonicalLogoUrl(
        { logoUrl: null },
        { logoUrl: "https://cdn.example.com/direct.png" },
        null,
        null,
      ),
    ).toBe("https://cdn.example.com/direct.png");
  });

  it("prefers team override over canonical Verein logo", () => {
    expect(
      resolveExternalTeamCanonicalLogoUrl(
        { logoUrl: "https://cdn.example.com/team.png" },
        { logoUrl: null },
        { logoUrl: CANONICAL_LOGO },
      ),
    ).toBe("https://cdn.example.com/team.png");
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
