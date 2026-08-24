/**
 * lib/publishing/presentation/__tests__/infoboard-team-display-name.test.ts
 */

import { describe, expect, it } from "vitest";
import { resolveInfoboardTeamDisplayName } from "../infoboard-team-display-name";

describe("resolveInfoboardTeamDisplayName", () => {
  it("prefers infoboardDisplayName over all other fields", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: "JUNIOREN E4",
        alternativeName: "Junioren E4",
        shortName: "E4",
        name: "E4",
        fallbackName: "Source",
      }),
    ).toBe("JUNIOREN E4");
  });

  it("ignores whitespace-only infoboardDisplayName", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: "   ",
        alternativeName: "Junioren E1",
        shortName: "E1",
        name: "E1",
      }),
    ).toBe("Junioren E1");
  });

  it("falls back to alternativeName when infoboardDisplayName is absent", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: null,
        alternativeName: "Junioren F2",
        shortName: "F2",
        name: "F2",
      }),
    ).toBe("Junioren F2");
  });

  it("falls back to shortName when higher priorities are absent", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        shortName: "E4",
        name: "FC Allschwil E4",
      }),
    ).toBe("E4");
  });

  it("falls back to name when higher priorities are absent", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        name: "FC Allschwil E4",
      }),
    ).toBe("FC Allschwil E4");
  });

  it("uses fallbackName only when canonical Team fields are unavailable", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: null,
        alternativeName: null,
        shortName: null,
        name: null,
        fallbackName: "Imported Team",
      }),
    ).toBe("Imported Team");
  });

  it("returns null when every candidate is absent", () => {
    expect(resolveInfoboardTeamDisplayName({})).toBeNull();
  });

  it("trims surrounding whitespace from resolved values", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: "  JUNIOREN F2  ",
      }),
    ).toBe("JUNIOREN F2");
  });
});
