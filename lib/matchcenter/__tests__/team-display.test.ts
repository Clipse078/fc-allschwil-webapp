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
