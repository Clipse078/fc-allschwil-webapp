/**
 * INFOBOARD-SCREEN1-STUDIO-01B — soft pagination + auto-compaction regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  buildDisplayList,
  computeEventDemand,
  expandOversizedTrainingGroups,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  resolveCardPresentation,
  resolveTrainingCardPresentation,
} from "@/lib/infoboard/screen1-card-presentation";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  TRAINING_FONT_SIZE_CSS,
  TRAINING_KABINE_FONT_SIZE_CSS,
  TRAINING_LOGO_SIZE_CSS,
  TRAINING_PLATZ_FONT_SIZE_CSS,
} from "@/lib/infoboard/screen1-logo-settings";
import {
  compactPagesForward,
  paginateExpandedDisplayListWithPreferences,
  validatePaginationIntegrity,
} from "@/lib/infoboard/screen1-pagination";
import { eventCardKey, trainingCohortKey } from "@/lib/infoboard/screen1-studio-keys";
import {
  EMPTY_SCREEN1_STUDIO_CONFIG,
  parseScreen1StudioJson,
  serializeScreen1StudioConfig,
  type Screen1StudioConfig,
} from "@/lib/infoboard/screen1-studio-types";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";

const MATCH_DEMAND = computeEventDemand("MATCH");

function matchEvent(id: string, startAt: string): InfoboardScreen1Event {
  return {
    id: eventCardKey(id),
    type: "MATCH",
    displayTitle: id,
    teamDisplayName: id,
    opponentDisplayName: "Opponent",
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt,
    endAt: null,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    seasonKey: "2025-26",
    allocation: {
      pitchLabel: "KR 1",
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
  };
}

function eventItem(id: string, startAt: string): DisplayItem {
  return {
    kind: "event",
    item: {
      temporal: "current",
      event: matchEvent(id, startAt),
    },
  };
}

function trainingItem(
  startAt: string,
  labels: string[],
): DisplayItem {
  const items: FlatEvent[] = labels.map((label, index) => ({
    temporal: "current" as const,
    event: {
      ...matchEvent(`training:${label}`, startAt),
      id: `training:${label}-${index}`,
      type: "TRAINING",
      teamDisplayName: label,
      displayTitle: label,
    },
  }));
  return { kind: "training-group", items };
}

function paginateCards(
  cards: DisplayItem[],
  maxDemand: number,
  studio: Screen1StudioConfig = EMPTY_SCREEN1_STUDIO_CONFIG,
): DisplayItem[][] {
  const demands = cards.map(() => MATCH_DEMAND);
  const { items, demands: expandedDemands } = expandOversizedTrainingGroups(
    cards,
    demands,
    maxDemand,
  );
  return paginateExpandedDisplayListWithPreferences(items, expandedDemands, {
    maxDemand,
    studio,
  });
}

function pageLabels(pages: DisplayItem[][]): string[] {
  return pages.flatMap((page) =>
    page.map((item) =>
      item.kind === "training-group"
        ? item.items.map((row) => row.event.teamDisplayName ?? "?").join("+")
        : item.item.event.teamDisplayName ?? "?",
    ),
  );
}

describe("INFOBOARD-SCREEN1-STUDIO-01B pagination", () => {
  it("mandatory: expired earlier card compacts deferred card forward", () => {
    const initialMaxDemand = MATCH_DEMAND * 4;
    const afterExpiryMaxDemand = 7.5;
    const cards = ["A", "B", "C", "D", "E"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("D")]: { preferNextPage: true },
      },
    };

    const initial = paginateCards(cards, initialMaxDemand, studio);
    expect(initial).toHaveLength(2);
    expect(
      initial[0]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["A", "B", "C"]);
    expect(
      initial[1]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["D", "E"]);

    const afterExpiry = paginateCards(
      cards.slice(1),
      afterExpiryMaxDemand,
      studio,
    );
    expect(afterExpiry).toHaveLength(2);
    expect(
      afterExpiry[0]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["B", "C", "D"]);
    expect(
      afterExpiry[1]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["E"]);
  });

  it("mandatory: capacity blocks unsafe forward compaction", () => {
    const maxDemand = 6;
    const cards = ["A", "B", "C", "D", "E"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("D")]: { preferNextPage: true },
      },
    };

    const afterExpiry = paginateCards(cards.slice(1), maxDemand, studio);
    expect(
      afterExpiry[0]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["B", "C"]);
    expect(
      afterExpiry[1]!.map((c) =>
        c.kind === "event" ? c.item.event.teamDisplayName : "",
      ),
    ).toEqual(["D", "E"]);
  });

  it("no overrides preserves greedy pagination behavior", () => {
    const maxDemand = MATCH_DEMAND * 3;
    const cards = ["A", "B", "C", "D"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const pages = paginateCards(cards, maxDemand);
    expect(pages[0]).toHaveLength(3);
    expect(pages[1]).toHaveLength(1);
  });

  it("reports no duplicates or missing cards after repagination", () => {
    const cards = ["A", "B", "C", "D", "E", "F"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("C")]: { preferNextPage: true },
        [eventCardKey("E")]: { preferNextPage: true },
      },
    };
    const pages = paginateCards(cards, MATCH_DEMAND * 3, studio);
    const integrity = validatePaginationIntegrity(cards, pages);
    expect(integrity.ok).toBe(true);
    expect(integrity.duplicates).toBe(0);
    expect(integrity.missing).toBe(0);
    expect(integrity.orderValid).toBe(true);
  });

  it("compactPagesForward pulls cards when capacity allows", () => {
    const cards = ["B", "C", "D", "E"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const demands = cards.map(() => 2);
    const pages = compactPagesForward(
      [cards.slice(0, 2), cards.slice(2)],
      (item) => demands[cards.indexOf(item)] ?? 2,
      7,
      EMPTY_SCREEN1_STUDIO_CONFIG,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(3);
    expect(pages[1]).toHaveLength(1);
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01B card presentation", () => {
  it("inherits global settings without overrides", () => {
    const item = trainingItem("2026-08-27T18:45:00.000Z", ["Team A"]);
    const resolved = resolveCardPresentation(
      item,
      DEFAULT_SCREEN1_PRESENTATION,
      EMPTY_SCREEN1_STUDIO_CONFIG,
    );
    expect(resolved.kind).toBe("training");
    if (resolved.kind === "training") {
      expect(resolved.presentation.teamFontSize).toBe(
        DEFAULT_SCREEN1_PRESENTATION.trainingFontSize,
      );
      expect(resolved.presentation.kabineFontSize).toBe(
        DEFAULT_SCREEN1_PRESENTATION.trainingFontSize,
      );
      expect(resolved.presentation.platzFontSize).toBe(
        DEFAULT_SCREEN1_PRESENTATION.trainingFontSize,
      );
    }
  });

  it("applies independent team, kabine, platz overrides", () => {
    const item = trainingItem("2026-08-27T18:45:00.000Z", ["Team A", "Team B"]);
    const key = trainingCohortKey("2026-08-27T18:45:00.000Z");
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [key]: {
          teamFontSize: "LARGE",
          kabineFontSize: "SMALL",
          platzFontSize: "MEDIUM",
          logoSize: "XLARGE",
        },
      },
    };
    const resolved = resolveTrainingCardPresentation(
      DEFAULT_SCREEN1_PRESENTATION,
      studio.cardOverrides[key],
    );
    expect(resolved.teamFontSize).toBe("LARGE");
    expect(resolved.kabineFontSize).toBe("SMALL");
    expect(resolved.platzFontSize).toBe("MEDIUM");
    expect(resolved.logoSize).toBe("XLARGE");
  });

  it("global changes affect cards without overrides", () => {
    const global = {
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "SMALL" as const,
    };
    const item = trainingItem("2026-08-27T19:00:00.000Z", ["Team"]);
    const resolved = resolveCardPresentation(item, global, EMPTY_SCREEN1_STUDIO_CONFIG);
    expect(resolved.kind).toBe("training");
    if (resolved.kind === "training") {
      expect(resolved.presentation.teamFontSize).toBe("SMALL");
    }
  });

  it("explicit override is not overwritten by global change", () => {
    const global = {
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "SMALL" as const,
    };
    const key = trainingCohortKey("2026-08-27T19:00:00.000Z");
    const studio: Screen1StudioConfig = {
      cardOverrides: { [key]: { teamFontSize: "XLARGE" } },
    };
    const resolved = resolveCardPresentation(
      trainingItem("2026-08-27T19:00:00.000Z", ["Team"]),
      global,
      studio,
    );
    expect(resolved.kind).toBe("training");
    if (resolved.kind === "training") {
      expect(resolved.presentation.teamFontSize).toBe("XLARGE");
    }
  });

  it("reset / empty override restores inherited values", () => {
    const resolved = resolveTrainingCardPresentation(DEFAULT_SCREEN1_PRESENTATION, {});
    expect(resolved.teamFontSize).toBe(DEFAULT_SCREEN1_PRESENTATION.trainingFontSize);
    expect(resolved.kabineFontSize).toBe(DEFAULT_SCREEN1_PRESENTATION.trainingFontSize);
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01B persistence", () => {
  it("parses and serializes studio JSON safely", () => {
    const json = serializeScreen1StudioConfig({
      cardOverrides: {
        "match:abc": { teamFontSize: "LARGE", preferNextPage: true },
        [trainingCohortKey("2026-08-27T18:45:00.000Z")]: {
          kabineFontSize: "SMALL",
        },
      },
    });
    const parsed = parseScreen1StudioJson(json);
    expect(parsed.cardOverrides["match:abc"]?.teamFontSize).toBe("LARGE");
    expect(parsed.cardOverrides["match:abc"]?.preferNextPage).toBe(true);
    expect(
      parsed.cardOverrides[trainingCohortKey("2026-08-27T18:45:00.000Z")]?.kabineFontSize,
    ).toBe("SMALL");
  });

  it("rejects invalid override values in parse", () => {
    const parsed = parseScreen1StudioJson(
      JSON.stringify({
        cardOverrides: {
          "match:x": { teamFontSize: "HUGE", kabineFontSize: "SMALL" },
        },
      }),
    );
    expect(parsed.cardOverrides["match:x"]?.teamFontSize).toBeUndefined();
    expect(parsed.cardOverrides["match:x"]?.kabineFontSize).toBe("SMALL");
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01B cohort grouping", () => {
  it("keeps same-start trainings as one studio card unit", () => {
    const startAt = "2026-08-27T18:45:00.000Z";
    const flat: FlatEvent[] = ["A", "B", "C"].map((label) => ({
      temporal: "current" as const,
      event: {
        ...matchEvent(`training:${label}`, startAt),
        id: `training:${label}`,
        type: "TRAINING",
        teamDisplayName: label,
      },
    }));
    const displayList = buildDisplayList(flat);
    expect(displayList).toHaveLength(1);
    expect(displayList[0]?.kind).toBe("training-group");
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01B typography CSS maps", () => {
  it("exposes independent kabine and platz clamp maps", () => {
    expect(TRAINING_KABINE_FONT_SIZE_CSS.SMALL).toContain("clamp");
    expect(TRAINING_PLATZ_FONT_SIZE_CSS.XLARGE).toContain("clamp");
    expect(TRAINING_FONT_SIZE_CSS.LARGE.normal).toContain("clamp");
    expect(TRAINING_LOGO_SIZE_CSS.MEDIUM).toContain("clamp");
  });
});
