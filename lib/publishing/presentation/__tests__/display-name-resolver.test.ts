/**
 * lib/publishing/presentation/__tests__/display-name-resolver.test.ts
 *
 * Unit tests for the display-name resolvers.
 *
 * Coverage:
 *   - Shared normalization (trimming, blank handling, internal whitespace,
 *     capitalization, immutability)
 *   - Team INFOBOARD resolution (verified field priorities)
 *   - Team WEBSITE resolution (verified field priorities)
 *   - Opponent INFOBOARD resolution (infoboardName → shortName → officialName → fallback)
 *   - Opponent WEBSITE resolution (websiteName → officialName → shortName → fallback)
 *   - Competition display resolution (competitionLabel → fallbackLabel)
 *   - Null handling for all resolvers
 *   - Input immutability
 *
 * No mocks required: all functions under test are pure.
 */

import { describe, it, expect } from "vitest";
import {
  resolveTeamDisplayName,
  resolveOpponentDisplayName,
  resolveCompetitionDisplay,
} from "../display-name-resolver";
import type {
  TeamDisplayNameInput,
  OpponentDisplayNameInput,
  CompetitionDisplayInput,
} from "../display-name-resolver";

// ── Shared normalization ───────────────────────────────────────────────────────

describe("shared string normalization", () => {
  it("trims surrounding whitespace from team name", () => {
    expect(
      resolveTeamDisplayName({ name: "  FC Allschwil  " }, "WEBSITE"),
    ).toBe("FC Allschwil");
  });

  it("treats a blank string as absent (team)", () => {
    expect(
      resolveTeamDisplayName({ name: "", displayName: "FC Allschwil" }, "WEBSITE"),
    ).toBe("FC Allschwil");
  });

  it("treats a whitespace-only string as absent (team)", () => {
    expect(
      resolveTeamDisplayName(
        { displayName: "   ", name: "FC Allschwil" },
        "WEBSITE",
      ),
    ).toBe("FC Allschwil");
  });

  it("preserves internal whitespace (opponent)", () => {
    expect(
      resolveOpponentDisplayName(
        { officialName: "FC  Basel  1893" },
        "WEBSITE",
      ),
    ).toBe("FC  Basel  1893");
  });

  it("preserves capitalization (team)", () => {
    expect(
      resolveTeamDisplayName({ name: "fcA U12" }, "INFOBOARD"),
    ).toBe("fcA U12");
  });

  it("does not mutate the team input object", () => {
    const input: TeamDisplayNameInput = Object.freeze({
      name: "FC Allschwil",
      displayName: "1. Mannschaft",
    });
    resolveTeamDisplayName(input, "WEBSITE");
    resolveTeamDisplayName(input, "INFOBOARD");
    // Object.freeze ensures no write throws; reaching here means no mutation.
    expect(input.name).toBe("FC Allschwil");
    expect(input.displayName).toBe("1. Mannschaft");
  });

  it("does not mutate the opponent input object", () => {
    const input: OpponentDisplayNameInput = Object.freeze({
      officialName: "FC Basel 1893",
      shortName: "FCB",
    });
    resolveOpponentDisplayName(input, "INFOBOARD");
    resolveOpponentDisplayName(input, "WEBSITE");
    expect(input.officialName).toBe("FC Basel 1893");
    expect(input.shortName).toBe("FCB");
  });

  it("does not mutate the competition input object", () => {
    const input: CompetitionDisplayInput = Object.freeze({
      competitionLabel: "4. Liga",
    });
    resolveCompetitionDisplay(input);
    expect(input.competitionLabel).toBe("4. Liga");
  });
});

// ── Team — INFOBOARD ──────────────────────────────────────────────────────────

describe("resolveTeamDisplayName — INFOBOARD", () => {
  it("returns infoboardDisplayName when available (priority 1)", () => {
    expect(
      resolveTeamDisplayName(
        {
          infoboardDisplayName: "JUNIOREN E4",
          alternativeName: "Junioren E4",
          shortName: "E4",
          displayName: "Season Override",
          name: "E4",
          fallbackName: "Fallback",
        },
        "INFOBOARD",
      ),
    ).toBe("JUNIOREN E4");
  });

  it("falls through to alternativeName when infoboardDisplayName is blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          infoboardDisplayName: "  ",
          alternativeName: "Junioren F2",
          shortName: "F2",
          name: "F2",
        },
        "INFOBOARD",
      ),
    ).toBe("Junioren F2");
  });

  it("falls through to shortName when infoboardDisplayName and alternativeName are blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          shortName: "U12a",
          displayName: "U12a Junioren",
          name: "FC Allschwil",
          alternativeName: null,
          fallbackName: "Fallback",
        },
        "INFOBOARD",
      ),
    ).toBe("U12a");
  });

  it("falls through to Team.name when higher priorities are blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          shortName: "  ",
          displayName: "U12a Junioren",
          name: "FC Allschwil",
        },
        "INFOBOARD",
      ),
    ).toBe("FC Allschwil");
  });

  it("does not use TeamSeason.displayName on INFOBOARD", () => {
    expect(
      resolveTeamDisplayName(
        {
          shortName: null,
          displayName: "Junioren B2",
          name: "FC Allschwil Junioren B2",
        },
        "INFOBOARD",
      ),
    ).toBe("FC Allschwil Junioren B2");
  });

  it("falls through to Team.alternativeName when shortName and name are blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          shortName: null,
          displayName: "Season Override",
          name: null,
          alternativeName: "Junioren B2",
        },
        "INFOBOARD",
      ),
    ).toBe("Junioren B2");
  });

  it("uses fallbackName as last resort", () => {
    expect(
      resolveTeamDisplayName(
        {
          shortName: null,
          displayName: null,
          name: null,
          fallbackName: "Source Fallback",
        },
        "INFOBOARD",
      ),
    ).toBe("Source Fallback");
  });

  it("returns null when all values are absent", () => {
    expect(
      resolveTeamDisplayName(
        { shortName: null, displayName: null, name: null, fallbackName: null },
        "INFOBOARD",
      ),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveTeamDisplayName({}, "INFOBOARD")).toBeNull();
  });

  it("trims infoboardDisplayName on INFOBOARD", () => {
    expect(
      resolveTeamDisplayName({ infoboardDisplayName: "  JUNIOREN E1  " }, "INFOBOARD"),
    ).toBe("JUNIOREN E1");
  });
});

// ── Team — WEBSITE ────────────────────────────────────────────────────────────

describe("resolveTeamDisplayName — WEBSITE", () => {
  it("returns displayName when available (priority 1)", () => {
    expect(
      resolveTeamDisplayName(
        {
          displayName: "U12a Junioren",
          name: "FC Allschwil",
          shortName: "U12a",
          fallbackName: "Fallback",
        },
        "WEBSITE",
      ),
    ).toBe("U12a Junioren");
  });

  it("falls through to name when displayName is blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          displayName: "",
          name: "FC Allschwil",
          shortName: "FCA",
        },
        "WEBSITE",
      ),
    ).toBe("FC Allschwil");
  });

  it("falls through to shortName when displayName and name are blank", () => {
    expect(
      resolveTeamDisplayName(
        {
          displayName: null,
          name: "  ",
          shortName: "FCA",
        },
        "WEBSITE",
      ),
    ).toBe("FCA");
  });

  it("uses fallbackName as last resort", () => {
    expect(
      resolveTeamDisplayName(
        {
          displayName: null,
          name: null,
          shortName: null,
          fallbackName: "Source Title",
        },
        "WEBSITE",
      ),
    ).toBe("Source Title");
  });

  it("returns null when all values are absent", () => {
    expect(
      resolveTeamDisplayName(
        { displayName: null, name: null, shortName: null, fallbackName: null },
        "WEBSITE",
      ),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveTeamDisplayName({}, "WEBSITE")).toBeNull();
  });

  it("trims displayName on WEBSITE", () => {
    expect(
      resolveTeamDisplayName({ displayName: "  Erste Mannschaft  " }, "WEBSITE"),
    ).toBe("Erste Mannschaft");
  });
});

// ── Opponent — INFOBOARD ──────────────────────────────────────────────────────

describe("resolveOpponentDisplayName — INFOBOARD", () => {
  it("returns infoboardName (priority 1)", () => {
    expect(
      resolveOpponentDisplayName(
        {
          infoboardName: "FCB",
          shortName: "FC Basel",
          officialName: "FC Basel 1893",
          fallbackName: "Basel",
        },
        "INFOBOARD",
      ),
    ).toBe("FCB");
  });

  it("falls through to shortName when infoboardName is blank", () => {
    expect(
      resolveOpponentDisplayName(
        {
          infoboardName: "  ",
          shortName: "FC Basel",
          officialName: "FC Basel 1893",
        },
        "INFOBOARD",
      ),
    ).toBe("FC Basel");
  });

  it("falls through to officialName when infoboardName and shortName are blank", () => {
    expect(
      resolveOpponentDisplayName(
        {
          infoboardName: null,
          shortName: "",
          officialName: "FC Basel 1893",
        },
        "INFOBOARD",
      ),
    ).toBe("FC Basel 1893");
  });

  it("uses fallbackName as last resort", () => {
    expect(
      resolveOpponentDisplayName(
        {
          infoboardName: null,
          shortName: null,
          officialName: null,
          fallbackName: "Raw Opponent",
        },
        "INFOBOARD",
      ),
    ).toBe("Raw Opponent");
  });

  it("returns null when all values are absent", () => {
    expect(
      resolveOpponentDisplayName(
        {
          infoboardName: null,
          shortName: null,
          officialName: null,
          fallbackName: null,
        },
        "INFOBOARD",
      ),
    ).toBeNull();
  });

  it("skips blank infoboardName and finds shortName", () => {
    expect(
      resolveOpponentDisplayName(
        { infoboardName: "", shortName: "FCB", officialName: "FC Basel 1893" },
        "INFOBOARD",
      ),
    ).toBe("FCB");
  });

  it("returns null for empty input", () => {
    expect(resolveOpponentDisplayName({}, "INFOBOARD")).toBeNull();
  });
});

// ── Opponent — WEBSITE ────────────────────────────────────────────────────────

describe("resolveOpponentDisplayName — WEBSITE", () => {
  it("returns websiteName (priority 1)", () => {
    expect(
      resolveOpponentDisplayName(
        {
          websiteName: "Basel",
          officialName: "FC Basel 1893",
          shortName: "FCB",
          fallbackName: "Fallback",
        },
        "WEBSITE",
      ),
    ).toBe("Basel");
  });

  it("falls through to officialName when websiteName is blank", () => {
    expect(
      resolveOpponentDisplayName(
        {
          websiteName: "",
          officialName: "FC Basel 1893",
          shortName: "FCB",
        },
        "WEBSITE",
      ),
    ).toBe("FC Basel 1893");
  });

  it("falls through to shortName when websiteName and officialName are blank", () => {
    expect(
      resolveOpponentDisplayName(
        {
          websiteName: null,
          officialName: "  ",
          shortName: "FCB",
        },
        "WEBSITE",
      ),
    ).toBe("FCB");
  });

  it("uses fallbackName as last resort", () => {
    expect(
      resolveOpponentDisplayName(
        {
          websiteName: null,
          officialName: null,
          shortName: null,
          fallbackName: "Raw Name",
        },
        "WEBSITE",
      ),
    ).toBe("Raw Name");
  });

  it("returns null when all values are absent", () => {
    expect(
      resolveOpponentDisplayName(
        {
          websiteName: null,
          officialName: null,
          shortName: null,
          fallbackName: null,
        },
        "WEBSITE",
      ),
    ).toBeNull();
  });

  it("skips blank websiteName and finds officialName", () => {
    expect(
      resolveOpponentDisplayName(
        { websiteName: "   ", officialName: "FC Basel 1893" },
        "WEBSITE",
      ),
    ).toBe("FC Basel 1893");
  });

  it("returns null for empty input", () => {
    expect(resolveOpponentDisplayName({}, "WEBSITE")).toBeNull();
  });
});

// ── Competition display ───────────────────────────────────────────────────────

describe("resolveCompetitionDisplay", () => {
  it("returns competitionLabel (priority 1)", () => {
    expect(
      resolveCompetitionDisplay({
        competitionLabel: "4. Liga",
        fallbackLabel: "Fallback",
      }),
    ).toBe("4. Liga");
  });

  it("falls through to fallbackLabel when competitionLabel is blank", () => {
    expect(
      resolveCompetitionDisplay({
        competitionLabel: "",
        fallbackLabel: "Kantonalliga",
      }),
    ).toBe("Kantonalliga");
  });

  it("falls through to fallbackLabel when competitionLabel is whitespace-only", () => {
    expect(
      resolveCompetitionDisplay({
        competitionLabel: "  ",
        fallbackLabel: "Kantonalliga",
      }),
    ).toBe("Kantonalliga");
  });

  it("returns null when both values are absent", () => {
    expect(
      resolveCompetitionDisplay({
        competitionLabel: null,
        fallbackLabel: null,
      }),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveCompetitionDisplay({})).toBeNull();
  });

  it("trims surrounding whitespace from competitionLabel", () => {
    expect(
      resolveCompetitionDisplay({ competitionLabel: "  4. Liga  " }),
    ).toBe("4. Liga");
  });

  it("preserves internal whitespace in competitionLabel", () => {
    expect(
      resolveCompetitionDisplay({ competitionLabel: "4.  Liga Gruppe A" }),
    ).toBe("4.  Liga Gruppe A");
  });

  it("does not concatenate labels", () => {
    const result = resolveCompetitionDisplay({
      competitionLabel: "4. Liga",
      fallbackLabel: "Gruppe A",
    });
    expect(result).toBe("4. Liga");
    expect(result).not.toContain("Gruppe A");
  });

  it("does not mutate the input object", () => {
    const input: CompetitionDisplayInput = Object.freeze({
      competitionLabel: "4. Liga",
      fallbackLabel: "Fallback",
    });
    resolveCompetitionDisplay(input);
    expect(input.competitionLabel).toBe("4. Liga");
  });
});
