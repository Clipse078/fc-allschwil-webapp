import { describe, expect, it } from "vitest";
import { resolveMatchcenterCompactSideName } from "../team-display";
import type { MatchcenterSide } from "../types";

function side(overrides: Partial<MatchcenterSide> = {}): MatchcenterSide {
  return {
    providerTeamId: 1,
    providerTeamName: "Provider Team",
    canonicalTeamId: "team-1",
    canonicalTeamName: "FC Allschwil Junioren B2",
    displayName: "FC Allschwil Junioren B2",
    resolution: "RESOLVED",
    isOwnTeam: true,
    ...overrides,
  };
}

describe("resolveMatchcenterCompactSideName — TEAM-IDENTITY-01 compact resolver", () => {
  it("M. prefers Team.shortName for the FCA side in compact contexts", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({ canonicalTeamShortName: "B2" }),
      ),
    ).toBe("B2");
  });

  it("falls back to Team.name when shortName is absent", () => {
    expect(
      resolveMatchcenterCompactSideName(side({ canonicalTeamShortName: null })),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("falls back to Team.alternativeName when name is absent (edge case)", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamShortName: null,
          canonicalTeamName: null,
          canonicalTeamAlternativeName: "Junioren B2",
        }),
      ),
    ).toBe("Junioren B2");
  });

  it("uses providerTeamName as a last resort when no canonical Team exists", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamId: null,
          canonicalTeamName: null,
          canonicalTeamShortName: null,
          canonicalTeamAlternativeName: null,
          resolution: "UNRESOLVED",
          providerTeamName: "VfR Kleinhüningen a",
          displayName: "VfR Kleinhüningen a",
        }),
      ),
    ).toBe("VfR Kleinhüningen a");
  });

  it("external opponents may continue displaying their provider name unchanged", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamId: null,
          canonicalTeamName: null,
          resolution: "UNRESOLVED",
          isOwnTeam: false,
          providerTeamName: "SV Muttenz a",
          displayName: "SV Muttenz a",
        }),
      ),
    ).toBe("SV Muttenz a");
  });

  it("CLUB-DIRECTORY-02: prefers the canonical ExternalTeam short name over the raw provider name", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamId: null,
          canonicalTeamName: null,
          canonicalTeamShortName: null,
          canonicalTeamAlternativeName: null,
          resolution: "UNRESOLVED",
          isOwnTeam: false,
          canonicalExternalTeamId: "ext-team-1",
          canonicalExternalTeamName: "SV Muttenz Erste Mannschaft",
          canonicalExternalTeamShortName: "1M",
          providerTeamName: "SV Muttenz a",
          displayName: "SV Muttenz Erste Mannschaft",
        }),
      ),
    ).toBe("1M");
  });

  it("CLUB-DIRECTORY-02: never lets the ExternalTeam identity override an own-team resolution", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamShortName: "B2",
          canonicalExternalTeamShortName: "SHOULD-NEVER-WIN",
        }),
      ),
    ).toBe("B2");
  });

  it("falls back to the long displayName when every naming source is absent", () => {
    expect(
      resolveMatchcenterCompactSideName(
        side({
          canonicalTeamId: null,
          canonicalTeamName: null,
          canonicalTeamShortName: null,
          canonicalTeamAlternativeName: null,
          providerTeamName: null,
          resolution: "UNRESOLVED",
          displayName: "Manually entered team",
        }),
      ),
    ).toBe("Manually entered team");
  });
});
