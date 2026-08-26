/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-REGRESSION-01F — shared training row matrix + adaptive admission.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  InfoboardScreen1,
  buildDisplayList,
  computeTrainingGroupDemand,
  computeMatchDemand,
  paginateDisplayList,
  CARD_DEMAND_PAGE_MAX,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
  WEDNESDAY_2026_08_26_PREVIEW_TIMES,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import {
  getScreen1LifecyclePhase,
  SCREEN1_POST_EVENT_GRACE_MINUTES,
  SCREEN1_PRE_EVENT_RELEVANCE_MINUTES,
} from "@/lib/publishing/infoboard/screen1-event-lifecycle";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

function renderWednesdayAt(at: keyof typeof WEDNESDAY_2026_08_26_PREVIEW_TIMES) {
  const nowIso = resolveWednesdayPreviewCurrentTimeIso(at);
  const feed = buildWednesday20260826Feed(nowIso);
  return render(
    <InfoboardScreen1 feed={feed} branding={BRANDING} currentTimeIso={nowIso} />,
  );
}

function trainingCard(rowCount: string): HTMLElement {
  const card = screen.getAllByTestId("event-row").find(
    (row) =>
      row.getAttribute("data-type") === "TRAINING" &&
      row.getAttribute("data-training-count") === rowCount,
  );
  if (card === undefined) {
    throw new Error(`Expected training card with ${rowCount} rows`);
  }
  return card;
}

function measureRowCenterY(row: HTMLElement, cellIndex: 0 | 1 | 2): number {
  const cells = row.querySelectorAll('[class*="trainingMatrixCell"]');
  const cell = cells.item(cellIndex);
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Missing training matrix cell at index ${cellIndex}`);
  }
  const rect = cell.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

function mockAlignedTrainingMatrixGeometry(card: HTMLElement): void {
  const rows = card.querySelectorAll('[data-testid="training-matrix-row"]');
  let rowTop = 200;
  const rowHeight = 44;

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function mockRect(this: HTMLElement) {
      const row = this.closest('[data-testid="training-matrix-row"]');
      if (row instanceof HTMLElement) {
        const cells = row.querySelectorAll('[class*="trainingMatrixCell"]');
        const cellIndex = Array.from(cells).indexOf(this);
        if (cellIndex >= 0) {
          const top = rowTop + Array.from(rows).indexOf(row) * rowHeight;
          return {
            top,
            left: 100 + cellIndex * 200,
            width: 180,
            height: rowHeight,
            right: 100 + cellIndex * 200 + 180,
            bottom: top + rowHeight,
            x: 100 + cellIndex * 200,
            y: top,
            toJSON: () => ({}),
          } as DOMRect;
        }
      }

      return {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
}

describe("INFOBOARD-REGRESSION-01F — shared training row matrix", () => {
  it("uses one shared row matrix per training cohort (not independent column lists)", () => {
    renderWednesdayAt("15:45");
    const card = trainingCard("4");

    expect(card.querySelectorAll('[data-testid="training-row-matrix"]')).toHaveLength(1);
    expect(card.querySelectorAll('[data-testid="training-matrix-row"]')).toHaveLength(4);
    expect(card.querySelectorAll('[class*="cardDressingRoomZone"]')).toHaveLength(0);
    expect(card.querySelectorAll('[class*="cardEventZone"]')).toHaveLength(0);

    for (const row of card.querySelectorAll('[data-testid="training-matrix-row"]')) {
      expect(row.querySelectorAll('[class*="trainingMatrixCell"]')).toHaveLength(3);
    }
  });

  it.each([
    ["4", "compact", "15:45"],
    ["5", "compact", "17:15"],
    ["6", "dense", "18:45"],
  ] as const)("assigns %s-row cohort to %s group density at %s", (rows, density, at) => {
    renderWednesdayAt(at);
    expect(trainingCard(rows).getAttribute("data-group-density")).toBe(density);
  });

  it("keeps TRAINING/KABINE/PLATZ row centers aligned within 1px (mocked geometry)", () => {
    renderWednesdayAt("15:45");
    const card = trainingCard("4");
    mockAlignedTrainingMatrixGeometry(card);

    let maxTrainingKabineDrift = 0;
    let maxTrainingPlatzDrift = 0;

    for (const row of card.querySelectorAll('[data-testid="training-matrix-row"]')) {
      if (!(row instanceof HTMLElement)) continue;
      const trainingY = measureRowCenterY(row, 0);
      const kabineY = measureRowCenterY(row, 1);
      const platzY = measureRowCenterY(row, 2);
      maxTrainingKabineDrift = Math.max(
        maxTrainingKabineDrift,
        Math.abs(trainingY - kabineY),
      );
      maxTrainingPlatzDrift = Math.max(
        maxTrainingPlatzDrift,
        Math.abs(trainingY - platzY),
      );
    }

    expect(maxTrainingKabineDrift).toBeLessThanOrEqual(1);
    expect(maxTrainingPlatzDrift).toBeLessThanOrEqual(1);
  });

  it("renders mixed-end annotation inline without splitting the row matrix", () => {
    renderWednesdayAt("15:45");
    const card = trainingCard("4");
    const f3Row = within(card)
      .getAllByTestId("training-group-row")
      .find((row) => row.textContent?.includes("F3"));
    const annotation = within(card).getByTestId("training-row-end-annotation");

    expect(f3Row?.contains(annotation)).toBe(true);
    expect(f3Row?.textContent?.toLowerCase()).not.toMatch(/^.*\bbis\b.*junioren f3/);
  });
});

describe("INFOBOARD-REGRESSION-01F — adaptive admission", () => {
  it("documents lifecycle constants", () => {
    expect(SCREEN1_PRE_EVENT_RELEVANCE_MINUTES).toBe(120);
    expect(SCREEN1_POST_EVENT_GRACE_MINUTES).toBe(15);
  });

  it("11:00 morning preview admits multiple same-day cohorts when capacity allows", () => {
    renderWednesdayAt("11:00");
    const cards = screen.getAllByTestId("event-row");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("JUNIOREN E3")).toBeTruthy();
    expect(screen.getByText("JUNIOREN D-7 D1")).toBeTruthy();
  });

  it("never splits a same-start cohort in display list construction", () => {
    const sharedStart = "2026-08-26T13:45:00.000Z";
    const flat: FlatEvent[] = ["A", "B", "C", "D"].map((label, index) => ({
      temporal: index === 0 ? "next" : "later",
      event: {
        id: `t-${index}`,
        type: "TRAINING",
        startAt: sharedStart,
        endAt: "2026-08-26T15:15:00.000Z",
        teamDisplayName: `TEAM ${label}`,
      } as InfoboardScreen1Event,
    }));

    const displayList = buildDisplayList(flat);
    expect(displayList).toHaveLength(1);
    expect(displayList[0]?.kind).toBe("training-group");
    if (displayList[0]?.kind === "training-group") {
      expect(displayList[0].items).toHaveLength(4);
    }
  });

  it("chronological pagination keeps dense 18:45 cohort instead of leapfrogging", () => {
    function cohortItem(
      startAt: string,
      rowCount: number,
      temporal: "current" | "next" | "later" = "later",
    ): DisplayItem {
      const groupItems: FlatEvent[] = Array.from({ length: rowCount }, (_, i) => ({
        temporal,
        event: {
          id: `${startAt}-${i}`,
          type: "TRAINING",
          startAt,
          endAt: "2026-08-26T15:15:00.000Z",
          teamDisplayName: `Team ${i}`,
        } as InfoboardScreen1Event,
      }));
      return { kind: "training-group", items: groupItems, temporal };
    }

    const items: DisplayItem[] = [
      cohortItem("2026-08-26T13:45:00.000Z", 4, "next"),
      cohortItem("2026-08-26T15:15:00.000Z", 5),
      cohortItem("2026-08-26T16:45:00.000Z", 6),
    ];
    const demands = items.map((item) =>
      item.kind === "training-group"
        ? computeTrainingGroupDemand(item.items.length)
        : computeMatchDemand(item.item.event),
    );

    const pages = paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX);
    const flattenedStarts = pages.flat().map((item) =>
      item.kind === "training-group"
        ? item.items[0]?.event.startAt
        : item.item.event.startAt,
    );
    expect(flattenedStarts).toEqual([
      "2026-08-26T13:45:00.000Z",
      "2026-08-26T15:15:00.000Z",
      "2026-08-26T16:45:00.000Z",
    ]);
    expect(pages.length).toBeGreaterThan(1);
  });
});

describe("INFOBOARD-REGRESSION-01F — Wednesday time matrix", () => {
  const matrixCases = [
    ["11:00", 2, ["15:45"]],
    ["15:44", 1, ["15:45"]],
    ["15:45", 1, ["15:45"]],
    ["17:15", 2, ["17:15", "18:45"]],
    ["19:45", 2, ["19:45", "20:15"]],
  ] as const;

  it.each(matrixCases)(
    "%s shows expected cohort count",
    (at, minCards) => {
      renderWednesdayAt(at);
      expect(screen.getAllByTestId("event-row").length).toBeGreaterThanOrEqual(minCards);
    },
  );
});

describe("INFOBOARD-REGRESSION-01F — lifecycle phases", () => {
  const sample: InfoboardScreen1Event = {
    id: "sample",
    type: "TRAINING",
    displayTitle: "JUNIOREN E3",
    teamDisplayName: "JUNIOREN E3",
    opponentDisplayName: null,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt: "2026-08-26T13:45:00.000Z",
    endAt: "2026-08-26T15:15:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "later",
    seasonKey: "2025-26",
    allocation: {
      pitchLabel: "KR 2 – FELD B",
      homeDressingRoomLabel: "Kabine E2",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
  };

  it("classifies pre-event within 120 minutes", () => {
    expect(
      getScreen1LifecyclePhase(sample, new Date("2026-08-26T11:45:00.000Z")),
    ).toBe("pre-event");
  });

  it("classifies current during the session", () => {
    expect(
      getScreen1LifecyclePhase(sample, new Date("2026-08-26T14:00:00.000Z")),
    ).toBe("current");
  });
});
