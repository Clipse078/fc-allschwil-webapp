/**
 * INFOBOARD-SCREEN1-STUDIO-02B — selected-card page retention regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  computeEventDemand,
  computeMatchDemand,
  computeTrainingGroupDemand,
  expandOversizedTrainingGroups,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { resolveCardDemandScale } from "@/lib/infoboard/screen1-card-presentation";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  resolveScreen1PageDemandMax,
} from "@/lib/infoboard/screen1-logo-settings";
import { paginateExpandedDisplayListWithPreferences } from "@/lib/infoboard/screen1-pagination";
import {
  eventCardKey,
  resolveDisplayItemKey,
  trainingCohortKey,
} from "@/lib/infoboard/screen1-studio-keys";
import { resolveStudioPageIndex } from "@/lib/infoboard/screen1-studio-page-retention";
import {
  EMPTY_SCREEN1_STUDIO_CONFIG,
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

type StudioPageRef = { key: string; label: string };

function toStudioPages(pages: DisplayItem[][]): StudioPageRef[][] {
  return pages.map((page) =>
    page.map((item) => ({
      key: resolveDisplayItemKey(item),
      label:
        item.kind === "training-group"
          ? item.items[0]?.event.teamDisplayName ?? "?"
          : item.item.event.teamDisplayName ?? "?",
    })),
  );
}

function paginateWithStudio(
  cards: DisplayItem[],
  studio: Screen1StudioConfig = EMPTY_SCREEN1_STUDIO_CONFIG,
): DisplayItem[][] {
  const maxDemand = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
  const baseDemands = cards.map((item) => {
    const scale = resolveCardDemandScale(item, DEFAULT_SCREEN1_PRESENTATION, studio);
    if (item.kind === "training-group") {
      return computeTrainingGroupDemand(item.items.length) * scale;
    }
    return computeMatchDemand(item.item.event) * scale;
  });
  const { items, demands: expandedDemands } = expandOversizedTrainingGroups(
    cards,
    baseDemands,
    maxDemand,
  );
  const scaledDemands = expandedDemands;
  return paginateExpandedDisplayListWithPreferences(items, scaledDemands, {
    maxDemand,
    studio,
  });
}

function resolvePageAfterEdit({
  pagesBefore,
  pagesAfter,
  selectedKey,
  previousPageIndex,
}: {
  pagesBefore: StudioPageRef[][];
  pagesAfter: StudioPageRef[][];
  selectedKey: string | null;
  previousPageIndex: number;
}): number {
  const beforeIndex = resolveStudioPageIndex({
    pages: pagesBefore,
    selectedKey,
    previousPageIndex,
  });
  expect(beforeIndex).toBe(previousPageIndex);
  return resolveStudioPageIndex({
    pages: pagesAfter,
    selectedKey,
    previousPageIndex,
  });
}

describe("INFOBOARD-SCREEN1-STUDIO-02B resolveStudioPageIndex", () => {
  const pages: StudioPageRef[][] = [
    [{ key: "a", label: "A" }, { key: "b", label: "B" }],
    [{ key: "c", label: "C" }],
  ];

  it("follows selected card on its current page", () => {
    expect(
      resolveStudioPageIndex({
        pages,
        selectedKey: "c",
        previousPageIndex: 1,
      }),
    ).toBe(1);
  });

  it("follows selected card when pagination legitimately moves it", () => {
    const repacked: StudioPageRef[][] = [
      [{ key: "a", label: "A" }, { key: "c", label: "C" }],
      [{ key: "b", label: "B" }],
    ];
    expect(
      resolveStudioPageIndex({
        pages: repacked,
        selectedKey: "c",
        previousPageIndex: 1,
      }),
    ).toBe(0);
  });

  it("clamps when selected card disappears", () => {
    const reduced: StudioPageRef[][] = [[{ key: "a", label: "A" }]];
    expect(
      resolveStudioPageIndex({
        pages: reduced,
        selectedKey: "c",
        previousPageIndex: 1,
      }),
    ).toBe(0);
  });

  it("retains numeric page when no card is selected", () => {
    expect(
      resolveStudioPageIndex({
        pages,
        selectedKey: null,
        previousPageIndex: 1,
      }),
    ).toBe(1);
  });

  it("clamps numeric page when page count shrinks without selection", () => {
    const reduced: StudioPageRef[][] = [[{ key: "a", label: "A" }]];
    expect(
      resolveStudioPageIndex({
        pages: reduced,
        selectedKey: null,
        previousPageIndex: 3,
      }),
    ).toBe(0);
  });

  it("returns 0 for empty pagination", () => {
    expect(
      resolveStudioPageIndex({
        pages: [],
        selectedKey: "c",
        previousPageIndex: 2,
      }),
    ).toBe(0);
  });
});

describe("INFOBOARD-SCREEN1-STUDIO-02B user repro and behavior matrix", () => {
  const fcAllschwilB1Key = eventCardKey("fc-allschwil-b1");
  const juniorenF3Key = trainingCohortKey("2026-08-27T18:00:00.000Z");
  const juniorenC1Key = trainingCohortKey("2026-08-27T18:30:00.000Z");
  const zweiteMannschaftKey = trainingCohortKey("2026-08-27T19:00:00.000Z");

  const userReproCards: DisplayItem[] = [
    trainingItem("2026-08-27T18:00:00.000Z", ["Junioren F3"]),
    trainingItem("2026-08-27T18:30:00.000Z", ["Junioren C1", "Extra"]),
    trainingItem("2026-08-27T19:00:00.000Z", ["2. Mannschaft", "Extra"]),
    eventItem("fc-allschwil-b1", "2026-08-27T20:00:00.000Z"),
  ];

  function buildUserReproPages(studio: Screen1StudioConfig): StudioPageRef[][] {
    const layoutStudio: Screen1StudioConfig = {
      cardOverrides: {
        ...studio.cardOverrides,
        [fcAllschwilB1Key]: {
          ...studio.cardOverrides[fcAllschwilB1Key],
          preferNextPage: true,
          softBreakAfterKeys: [
            juniorenF3Key,
            juniorenC1Key,
            zweiteMannschaftKey,
          ],
        },
      },
    };
    const pages = paginateWithStudio(userReproCards, layoutStudio);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.some((item) => resolveDisplayItemKey(item) === fcAllschwilB1Key)).toBe(
      true,
    );
    return toStudioPages(pages);
  }

  it("A — user repro: FC Allschwil B1 stays on page 2 after team font M -> S", () => {
    const beforeStudio: Screen1StudioConfig = {
      cardOverrides: {
        [fcAllschwilB1Key]: { teamFontSize: "MEDIUM" },
      },
    };
    const afterStudio: Screen1StudioConfig = {
      cardOverrides: {
        [fcAllschwilB1Key]: { teamFontSize: "SMALL" },
      },
    };
    const pagesBefore = buildUserReproPages(beforeStudio);
    const pagesAfter = buildUserReproPages(afterStudio);
    const pageAfterEdit = resolvePageAfterEdit({
      pagesBefore,
      pagesAfter,
      selectedKey: fcAllschwilB1Key,
      previousPageIndex: 1,
    });
    expect(pageAfterEdit).toBe(1);
    expect(
      pagesAfter[pageAfterEdit]!.some((card) => card.key === fcAllschwilB1Key),
    ).toBe(true);
  });

  it.each([
    ["kabineFontSize", "LARGE"],
    ["platzFontSize", "SMALL"],
    ["logoSize", "XLARGE"],
  ] as const)("B-D — %s change follows selected card on page 2", (field, value) => {
    const beforeStudio: Screen1StudioConfig = { cardOverrides: {} };
    const afterStudio: Screen1StudioConfig = {
      cardOverrides: {
        [fcAllschwilB1Key]: { [field]: value },
      },
    };
    const pagesBefore = buildUserReproPages(beforeStudio);
    const pagesAfter = buildUserReproPages(afterStudio);
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey: fcAllschwilB1Key,
        previousPageIndex: 1,
      }),
    ).toBe(1);
  });

  it("E — reset presentation follows selected card after repagination", () => {
    const beforeStudio: Screen1StudioConfig = {
      cardOverrides: {
        [fcAllschwilB1Key]: {
          teamFontSize: "XLARGE",
          kabineFontSize: "XLARGE",
          platzFontSize: "XLARGE",
          logoSize: "XLARGE",
        },
      },
    };
    const afterStudio: Screen1StudioConfig = { cardOverrides: {} };
    const pagesBefore = buildUserReproPages(beforeStudio);
    const pagesAfter = buildUserReproPages(afterStudio);
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey: fcAllschwilB1Key,
        previousPageIndex: 1,
      }),
    ).toBe(1);
  });

  it("F — soft page action follows selected card to its new page", () => {
    const cards = ["A", "B", "C", "D"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const selectedKey = eventCardKey("C");
    const beforeStudio: Screen1StudioConfig = { cardOverrides: {} };
    const afterStudio: Screen1StudioConfig = {
      cardOverrides: {
        [selectedKey]: {
          preferNextPage: true,
          softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B")],
        },
      },
    };
    const pagesBefore = toStudioPages(paginateWithStudio(cards, beforeStudio));
    const pagesAfter = toStudioPages(paginateWithStudio(cards, afterStudio));
    const beforePage = pagesBefore.findIndex((page) =>
      page.some((card) => card.key === selectedKey),
    );
    const movedPage = pagesAfter.findIndex((page) =>
      page.some((card) => card.key === selectedKey),
    );
    expect(beforePage).toBe(0);
    expect(movedPage).toBe(1);
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey,
        previousPageIndex: beforePage,
      }),
    ).toBe(movedPage);
  });

  it("F — back to automatic follows selected card after repagination", () => {
    const beforeStudio: Screen1StudioConfig = {
      cardOverrides: {
        [fcAllschwilB1Key]: {
          preferNextPage: true,
          softBreakAfterKeys: [
            juniorenF3Key,
            juniorenC1Key,
            zweiteMannschaftKey,
          ],
        },
      },
    };
    const afterStudio: Screen1StudioConfig = { cardOverrides: {} };
    const pagesBefore = buildUserReproPages(beforeStudio);
    const pagesAfter = buildUserReproPages(afterStudio);
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey: fcAllschwilB1Key,
        previousPageIndex: 1,
      }),
    ).toBe(1);
  });

  it("G — legitimate page move follows selected card instead of forcing old page", () => {
    const cards = ["A", "B", "C", "D"].map((id, index) =>
      eventItem(id, `2026-08-27T1${index}:00:00.000Z`),
    );
    const selectedKey = eventCardKey("D");
    const beforeStudio: Screen1StudioConfig = {
      cardOverrides: {
        [selectedKey]: {
          preferNextPage: true,
          softBreakAfterKeys: [
            eventCardKey("A"),
            eventCardKey("B"),
            eventCardKey("C"),
          ],
        },
      },
    };
    const afterStudio: Screen1StudioConfig = {
      cardOverrides: {
        [selectedKey]: {
          preferNextPage: true,
          softBreakAfterKeys: [eventCardKey("A"), eventCardKey("B")],
          teamFontSize: "SMALL",
        },
      },
    };
    const pagesBefore = toStudioPages(paginateWithStudio(cards, beforeStudio));
    const pagesAfter = toStudioPages(paginateWithStudio(cards, afterStudio));
    const movedPage = pagesAfter.findIndex((page) =>
      page.some((card) => card.key === selectedKey),
    );
    expect(movedPage).toBeGreaterThanOrEqual(0);
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey,
        previousPageIndex: 1,
      }),
    ).toBe(movedPage);
  });

  it("H — selected card disappearance clamps safely", () => {
    const pagesBefore: StudioPageRef[][] = [
      [{ key: "a", label: "A" }],
      [{ key: "b", label: "B" }],
    ];
    const pagesAfter: StudioPageRef[][] = [[{ key: "a", label: "A" }]];
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey: "b",
        previousPageIndex: 1,
      }),
    ).toBe(0);
  });

  it("I — no selection retains previous numeric page when possible", () => {
    const pagesBefore: StudioPageRef[][] = [
      [{ key: "a", label: "A" }],
      [{ key: "b", label: "B" }],
      [{ key: "c", label: "C" }],
    ];
    const pagesAfter: StudioPageRef[][] = [
      [{ key: "a", label: "A" }],
      [{ key: "b", label: "B" }],
    ];
    expect(
      resolvePageAfterEdit({
        pagesBefore,
        pagesAfter,
        selectedKey: null,
        previousPageIndex: 2,
      }),
    ).toBe(1);
  });
});
