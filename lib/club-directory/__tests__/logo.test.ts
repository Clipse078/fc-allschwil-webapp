import { describe, expect, it } from "vitest";

import {
  mergeProviderLogoUrl,
  resolveExternalClubLogoUrl,
  resolveExternalTeamLogoUrl,
  resolveOpponentCrestUrl,
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

// ── resolveOpponentCrestUrl ────────────────────────────────────────────────────
// Infoboard Screen 1 — INFOBOARD-UX-03-C1 opponent crest resolution.
// Canonical SFV-synced club crest takes priority over team-level upload.

describe("resolveOpponentCrestUrl — club crest preferred for Infoboard opponent display", () => {
  it("prefers the canonical club crest (ExternalClub.logoUrl) over team-level logo", () => {
    expect(
      resolveOpponentCrestUrl(
        { logoUrl: "https://cdn.example.com/team-override.png" },
        { logoUrl: "https://cdn.example.com/canonical-club-crest.png" },
      ),
    ).toBe("https://cdn.example.com/canonical-club-crest.png");
  });

  it("falls back to team logo when club has no crest", () => {
    expect(
      resolveOpponentCrestUrl(
        { logoUrl: "https://cdn.example.com/team-logo.png" },
        { logoUrl: null },
      ),
    ).toBe("https://cdn.example.com/team-logo.png");
  });

  it("returns null when neither club nor team has a logo", () => {
    expect(resolveOpponentCrestUrl({ logoUrl: null }, { logoUrl: null })).toBeNull();
  });

  it("treats blank club logo as absent — falls back to team logo", () => {
    expect(
      resolveOpponentCrestUrl(
        { logoUrl: "https://cdn.example.com/team.png" },
        { logoUrl: "  " },
      ),
    ).toBe("https://cdn.example.com/team.png");
  });

  it("uses the canonical club crest even when the team-level logo is also set", () => {
    // This is the fix for FC Schwarz-Weiss: team upload may be a white-background
    // PNG while ExternalClub.logoUrl is the official SFV-synced transparent crest.
    const result = resolveOpponentCrestUrl(
      { logoUrl: "https://cdn.example.com/schwarz-weiss-team-white-square.png" },
      { logoUrl: "https://cdn.example.com/schwarz-weiss-official-crest.png" },
    );
    expect(result).toBe("https://cdn.example.com/schwarz-weiss-official-crest.png");
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
