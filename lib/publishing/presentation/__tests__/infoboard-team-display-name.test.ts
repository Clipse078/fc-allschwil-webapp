/**
 * lib/publishing/presentation/__tests__/infoboard-team-display-name.test.ts
 */

import { describe, expect, it } from "vitest";
import { resolveInfoboardTeamDisplayName } from "../infoboard-team-display-name";

const BASE_TEAM = {
  infoboardDisplayName: "FCA E1",
  infoboardTrainingDisplayName: "Junioren E1",
  infoboardMatchDisplayName: "FC Allschwil E1",
  infoboardTournamentDisplayName: "FCA E1",
  alternativeName: "E1",
  shortName: "Junioren E1 short",
  name: "FC Allschwil Junioren E1",
  fallbackName: "Source",
};

describe("resolveInfoboardTeamDisplayName", () => {
  it("prefers infoboardDisplayName over all other fields without context", () => {
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

  it("1 — TRAINING context-specific name wins", () => {
    expect(resolveInfoboardTeamDisplayName(BASE_TEAM, "TRAINING")).toBe(
      "Junioren E1",
    );
  });

  it("2 — MATCH context-specific name wins", () => {
    expect(resolveInfoboardTeamDisplayName(BASE_TEAM, "MATCH")).toBe(
      "FC Allschwil E1",
    );
  });

  it("3 — TOURNAMENT context-specific name wins", () => {
    expect(resolveInfoboardTeamDisplayName(BASE_TEAM, "TOURNAMENT")).toBe(
      "FCA E1",
    );
  });

  it("4 — Training context empty falls back to generic infoboardDisplayName", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        { ...BASE_TEAM, infoboardTrainingDisplayName: null },
        "TRAINING",
      ),
    ).toBe("FCA E1");
  });

  it("5 — Match context empty falls back to generic infoboardDisplayName", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        { ...BASE_TEAM, infoboardMatchDisplayName: null },
        "MATCH",
      ),
    ).toBe("FCA E1");
  });

  it("6 — Tournament context empty falls back to generic infoboardDisplayName", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        { ...BASE_TEAM, infoboardTournamentDisplayName: null },
        "TOURNAMENT",
      ),
    ).toBe("FCA E1");
  });

  it("7 — generic empty falls back to alternativeName", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        {
          ...BASE_TEAM,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
        },
        "TRAINING",
      ),
    ).toBe("E1");
  });

  it("8 — alternative empty falls back to shortName", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        {
          ...BASE_TEAM,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          alternativeName: null,
        },
        "TRAINING",
      ),
    ).toBe("Junioren E1 short");
  });

  it("9 — shortName empty falls back to name", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        {
          ...BASE_TEAM,
          infoboardDisplayName: null,
          infoboardTrainingDisplayName: null,
          alternativeName: null,
          shortName: null,
        },
        "TRAINING",
      ),
    ).toBe("FC Allschwil Junioren E1");
  });

  it("10 — final source fallback", () => {
    expect(
      resolveInfoboardTeamDisplayName(
        {
          infoboardDisplayName: null,
          alternativeName: null,
          shortName: null,
          name: null,
          fallbackName: "Imported Team",
        },
        "MATCH",
      ),
    ).toBe("Imported Team");
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

  it("does not apply context-specific fields when context is omitted", () => {
    expect(
      resolveInfoboardTeamDisplayName({
        infoboardTrainingDisplayName: "Junioren E1",
        infoboardDisplayName: "FCA E1",
        alternativeName: "E1",
      }),
    ).toBe("FCA E1");
  });
});
