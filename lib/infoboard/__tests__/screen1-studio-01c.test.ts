/**
 * INFOBOARD-SCREEN1-STUDIO-01C — context-aware soft pagination + card controls.
 */

import { describe, expect, it } from "vitest";
import {
  computeEventDemand,
  computeTrainingGroupDemand,
  expandOversizedTrainingGroups,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  resolveCardPresentation,
  resolveMatchCardPresentation,
  resolveTournamentCardPresentation,
  resolveTrainingCardPresentation,
} from "@/lib/infoboard/screen1-card-presentation";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  resolveScreen1PageDemandMax,
} from "@/lib/infoboard/screen1-logo-settings";
import {
  paginateExpandedDisplayListWithPreferences,
  resolvePredecessorKeys,
  shouldSoftDeferCard,
  softBreakContextMatches,
  validatePaginationIntegrity,
} from "@/lib/infoboard/screen1-pagination";
import {
  captureSoftBreakAfterKeys,
  eventCardKey,
  trainingCohortKey,
} from "@/lib/infoboard/screen1-studio-keys";
import {
  clearSoftPaginationOverride,
  EMPTY_SCREEN1_STUDIO_CONFIG,
  isEmptyCardOverride,
  parseScreen1StudioJson,
  serializeScreen1StudioConfig,
  type Screen1CardOverride,
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
      awayDressingRoomLabel: "Kabine 2",
      refereeDressingRoomLabel: null,
    },
  };
}

function tournamentEvent(id: string, startAt: string): InfoboardScreen1Event {
  return {
    ...matchEvent(id, startAt),
    id: eventCardKey(id),
    type: "TOURNAMENT",
    displayTitle: `Turnier ${id}`,
    opponentDisplayName: null,
  };
}

function eventItem(
  id: string,
  startAt: string,
  type: "MATCH" | "TOURNAMENT" = "MATCH",
): DisplayItem {
  const event = type === "TOURNAMENT" ? tournamentEvent(id, startAt) : matchEvent(id, startAt);
  return {
    kind: "event",
    item: {
      temporal: "current",
      event,
    },
  };
}

function trainingItem(startAt: string, labels: string[]): DisplayItem {
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

function studioWithDefer(
  cardId: string,
  predecessorIds: string[],
): Screen1StudioConfig {
  return {
    cardOverrides: {
      [eventCardKey(cardId)]: {
        preferNextPage: true,
        softBreakAfterKeys: predecessorIds.map(eventCardKey),
      },
    },
  };
}

function paginateCards(
  cards: DisplayItem[],
  maxDemand: number,
  studio: Screen1StudioConfig = EMPTY_SCREEN1_STUDIO_CONFIG,
  demands?: number[],
): DisplayItem[][] {
  const cardDemands = demands ?? cards.map(() => MATCH_DEMAND);
  const { items, demands: expandedDemands } = expandOversizedTrainingGroups(
    cards,
    cardDemands,
    maxDemand,
  );
  return paginateExpandedDisplayListWithPreferences(items, expandedDemands, {
    maxDemand,
    studio,
  });
}

function pageLabels(pages: DisplayItem[][]): string[][] {
  return pages.map((page) =>
    page.map((item) =>
      item.kind === "training-group"
        ? item.items.map((row) => row.event.teamDisplayName ?? "?").join("+")
        : item.item.event.teamDisplayName ?? "?",
    ),
  );
}

function labelList(cards: DisplayItem[]): string[] {
  return cards.map((item) =>
    item.kind === "training-group"
      ? item.items[0]?.event.teamDisplayName ?? "?"
      : item.item.event.teamDisplayName ?? "?",
  );
}

describe("INFOBOARD-SCREEN1-STUDIO-01C soft pagination", () => {
  const cards = ["A", "B", "C", "D", "E"].map((id, index) =>
    eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
  );

  it("A: D deferred with captured predecessor context => P1 ABC / P2 DE", () => {
    const pages = paginateCards(
      cards,
      MATCH_DEMAND * 4,
      studioWithDefer("D", ["A", "B", "C"]),
    );
    expect(pageLabels(pages)).toEqual([["A", "B", "C"], ["D", "E"]]);
  });

  it("B: after A expires and capacity allows => P1 BCD / P2 E", () => {
    const pages = paginateCards(
      cards.slice(1),
      7.5,
      studioWithDefer("D", ["A", "B", "C"]),
    );
    expect(pageLabels(pages)).toEqual([["B", "C", "D"], ["E"]]);
  });

  it("C: after A expires but capacity insufficient => P1 BC / P2 DE", () => {
    const pages = paginateCards(
      cards.slice(1),
      6,
      studioWithDefer("D", ["A", "B", "C"]),
    );
    expect(pageLabels(pages)).toEqual([["B", "C"], ["D", "E"]]);
  });

  it("D: two large predecessor cards can support a soft break without a minimum count", () => {
    const largeDemand = 3;
    const pages = paginateCards(
      cards,
      largeDemand * 3,
      studioWithDefer("C", ["A", "B"]),
      cards.map(() => largeDemand),
    );
    expect(pageLabels(pages)).toEqual([["A", "B"], ["C", "D", "E"]]);
  });

  it("E: four small cards do not auto-break merely because count equals four", () => {
    const smallDemand = 1;
    const fourCards = cards.slice(0, 4);
    const pages = paginateCards(
      fourCards,
      smallDemand * 4,
      EMPTY_SCREEN1_STUDIO_CONFIG,
      fourCards.map(() => smallDemand),
    );
    expect(pages).toHaveLength(1);
    expect(pageLabels(pages)).toEqual([["A", "B", "C", "D"]]);
  });

  it("F: no absolute page number is persisted in studio JSON", () => {
    const json = serializeScreen1StudioConfig({
      cardOverrides: {
        [eventCardKey("D")]: {
          preferNextPage: true,
          softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B"), eventCardKey("C")],
        },
      },
    });
    expect(json).not.toMatch(/pageNumber|pageIndex|absolutePage/i);
    const parsed = parseScreen1StudioJson(json);
    expect(parsed.cardOverrides[eventCardKey("D")]?.preferNextPage).toBe(true);
    expect(parsed.cardOverrides[eventCardKey("D")]?.softBreakAfterKeys).toEqual([
      eventCardKey("A"),
      eventCardKey("B"),
      eventCardKey("C"),
    ]);
  });

  it("G: reset removes soft-break context", () => {
    const override: Screen1CardOverride = {
      teamFontSize: "LARGE",
      preferNextPage: true,
      softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B")],
    };
    const cleared = clearSoftPaginationOverride(override);
    expect(cleared?.preferNextPage).toBeUndefined();
    expect(cleared?.softBreakAfterKeys).toBeUndefined();
    expect(cleared?.teamFontSize).toBe("LARGE");
    expect(isEmptyCardOverride(cleared)).toBe(false);
    expect(isEmptyCardOverride({})).toBe(true);
  });

  it("legacy preferNextPage without softBreakAfterKeys is ignored", () => {
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("D")]: { preferNextPage: true },
      },
    };
    const pages = paginateCards(cards, MATCH_DEMAND * 4, studio);
    expect(pageLabels(pages)).toEqual([["A", "B", "C", "D"], ["E"]]);
  });

  it("M: no duplicate or missing display items after repagination", () => {
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("D")]: {
          preferNextPage: true,
          softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B"), eventCardKey("C")],
        },
      },
    };
    const pages = paginateCards(cards, MATCH_DEMAND * 3, studio);
    const integrity = validatePaginationIntegrity(cards, pages);
    expect(integrity.ok).toBe(true);
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01C soft-break helpers", () => {
  it("captureSoftBreakAfterKeys uses stable display-item keys only", () => {
    const ordered = [
      { key: eventCardKey("A") },
      { key: eventCardKey("B") },
      { key: trainingCohortKey("2026-08-27T18:45:00.000Z") },
      { key: eventCardKey("D") },
    ];
    expect(captureSoftBreakAfterKeys(ordered, eventCardKey("D"))).toEqual([
      eventCardKey("A"),
      eventCardKey("B"),
      trainingCohortKey("2026-08-27T18:45:00.000Z"),
    ]);
  });

  it("resolvePredecessorKeys and softBreakContextMatches gate deferral", () => {
    const items = ["A", "B", "C", "D"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const override: Screen1CardOverride = {
      preferNextPage: true,
      softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B")],
    };
    expect(resolvePredecessorKeys(items, 2)).toEqual([
      eventCardKey("A"),
      eventCardKey("B"),
    ]);
    expect(softBreakContextMatches(override, resolvePredecessorKeys(items, 2))).toBe(
      true,
    );
    expect(softBreakContextMatches(override, resolvePredecessorKeys(items, 3))).toBe(
      false,
    );
    expect(shouldSoftDeferCard(items[3]!, 3, items, EMPTY_SCREEN1_STUDIO_CONFIG)).toBe(
      false,
    );
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01C card presentation", () => {
  it("H: training team/kabine/platz overrides are independent", () => {
    const resolved = resolveTrainingCardPresentation(DEFAULT_SCREEN1_PRESENTATION, {
      teamFontSize: "LARGE",
      kabineFontSize: "SMALL",
      platzFontSize: "XLARGE",
      logoSize: "MEDIUM",
    });
    expect(resolved.teamFontSize).toBe("LARGE");
    expect(resolved.kabineFontSize).toBe("SMALL");
    expect(resolved.platzFontSize).toBe("XLARGE");
    expect(resolved.logoSize).toBe("MEDIUM");
  });

  it("I: match team/kabine/platz/logo overrides are independent", () => {
    const resolved = resolveMatchCardPresentation(DEFAULT_SCREEN1_PRESENTATION, {
      teamFontSize: "SMALL",
      kabineFontSize: "LARGE",
      platzFontSize: "MEDIUM",
      logoSize: "XLARGE",
    });
    expect(resolved.teamFontSize).toBe("SMALL");
    expect(resolved.kabineFontSize).toBe("LARGE");
    expect(resolved.platzFontSize).toBe("MEDIUM");
    expect(resolved.logoSize).toBe("XLARGE");
  });

  it("J: tournament team/kabine/platz/logo overrides are independent", () => {
    const resolved = resolveTournamentCardPresentation(DEFAULT_SCREEN1_PRESENTATION, {
      teamFontSize: "XLARGE",
      kabineFontSize: "MEDIUM",
      platzFontSize: "SMALL",
      logoSize: "LARGE",
    });
    expect(resolved.teamFontSize).toBe("XLARGE");
    expect(resolved.kabineFontSize).toBe("MEDIUM");
    expect(resolved.platzFontSize).toBe("SMALL");
    expect(resolved.logoSize).toBe("LARGE");
  });

  it("K: global default inheritance remains functional", () => {
    const global = {
      ...DEFAULT_SCREEN1_PRESENTATION,
      matchFontSize: "SMALL" as const,
    };
    const item = eventItem("Home", "2026-08-27T18:00:00.000Z");
    const resolved = resolveCardPresentation(item, global, EMPTY_SCREEN1_STUDIO_CONFIG);
    expect(resolved.kind).toBe("match");
    if (resolved.kind === "match") {
      expect(resolved.presentation.teamFontSize).toBe("SMALL");
      expect(resolved.presentation.kabineFontSize).toBe("SMALL");
      expect(resolved.presentation.platzFontSize).toBe("SMALL");
    }
  });

  it("L: explicit card override survives global default change", () => {
    const global = {
      ...DEFAULT_SCREEN1_PRESENTATION,
      matchFontSize: "SMALL" as const,
    };
    const studio: Screen1StudioConfig = {
      cardOverrides: {
        [eventCardKey("Home")]: {
          teamFontSize: "XLARGE",
          kabineFontSize: "LARGE",
        },
      },
    };
    const resolved = resolveCardPresentation(
      eventItem("Home", "2026-08-27T18:00:00.000Z"),
      global,
      studio,
    );
    expect(resolved.kind).toBe("match");
    if (resolved.kind === "match") {
      expect(resolved.presentation.teamFontSize).toBe("XLARGE");
      expect(resolved.presentation.kabineFontSize).toBe("LARGE");
      expect(resolved.presentation.platzFontSize).toBe("SMALL");
    }
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-01C integration contracts", () => {
  it("N: 175% presentation capacity contract remains stable", () => {
    const scaledMax = resolveScreen1PageDemandMax({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "XLARGE",
      matchFontSize: "XLARGE",
      tournamentFontSize: "XLARGE",
      trainingLogoSize: "XLARGE",
      matchLogoSize: "XLARGE",
      tournamentLogoSize: "XLARGE",
    });
    expect(scaledMax).toBeLessThan(8.5);
    const cards = ["A", "B", "C", "D"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const pages = paginateCards(cards, scaledMax);
    expect(pages.flat()).toHaveLength(4);
  });

  it("O: oversized cohort handling remains deterministic", () => {
    const labels = Array.from({ length: 15 }, (_, index) => `T${index + 1}`);
    const cohort = trainingItem("2026-08-27T18:45:00.000Z", labels);
    const maxDemand = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
    const cohortDemand = computeTrainingGroupDemand(labels.length);
    const { items, demands: expandedDemands } = expandOversizedTrainingGroups(
      [cohort],
      [cohortDemand],
      maxDemand,
    );
    expect(items.length).toBeGreaterThan(1);
    const pages = paginateExpandedDisplayListWithPreferences(
      items,
      expandedDemands,
      { maxDemand, studio: EMPTY_SCREEN1_STUDIO_CONFIG },
    );
    expect(pages.length).toBeGreaterThan(1);
    const renderedIds = pages.flatMap((page) =>
      page.flatMap((item) =>
        item.kind === "training-group"
          ? item.items.map(({ event }) => event.id)
          : [item.item.event.id],
      ),
    );
    expect(renderedIds).toHaveLength(labels.length);
    expect(new Set(renderedIds).size).toBe(labels.length);
    expect(
      items.some(
        (item) => item.kind === "training-group" && item.cohortContinuation === true,
      ),
    ).toBe(true);
  });

  it("repagination preserves chronological order after live list shrink", () => {
    const initial = paginateCards(cardsFixture(), 8.8, studioWithDefer("D", ["A", "B", "C"]));
    const shrunk = paginateCards(cardsFixture().slice(1), 7.5, studioWithDefer("D", ["A", "B", "C"]));
    expect(labelList(initial.flat())).toEqual(["A", "B", "C", "D", "E"]);
    expect(labelList(shrunk.flat())).toEqual(["B", "C", "D", "E"]);
  });
});

function cardsFixture(): DisplayItem[] {
  return ["A", "B", "C", "D", "E"].map((id, index) =>
    eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
  );
}
