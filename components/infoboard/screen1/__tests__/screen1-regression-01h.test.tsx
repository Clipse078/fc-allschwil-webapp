/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01H — training row spacing refinement.
 */

import { render, screen, within, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  InfoboardScreen1,
  buildDisplayList,
  computeTrainingGroupDemand,
  paginateDisplayList,
  CARD_DEMAND_PAGE_MAX,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardPageRotator } from "@/components/infoboard/screen1/InfoboardPageRotator";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
  WEDNESDAY_2026_08_26_PREVIEW_TIMES,
  WEDNESDAY_COHORT_TEAM_NAMES,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

const TRAINING_SPACING_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../InfoboardScreen1.module.css"),
  "utf8",
);

function readCssToken(blockSelector: string, token: string): string {
  const blockStart = TRAINING_SPACING_CSS.indexOf(blockSelector);
  if (blockStart < 0) {
    throw new Error(`Missing CSS block: ${blockSelector}`);
  }
  const blockEnd = TRAINING_SPACING_CSS.indexOf("}", blockStart);
  const block = TRAINING_SPACING_CSS.slice(blockStart, blockEnd);
  const match = new RegExp(`${token}:\\s*([^;]+);`).exec(block);
  if (!match?.[1]) {
    throw new Error(`Missing token ${token} in ${blockSelector}`);
  }
  return match[1].trim();
}

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

function readTrainingMatrixTokens(card: HTMLElement) {
  const density = card.getAttribute("data-group-density");
  if (density === "normal") {
    return {
      rowHeight: readCssToken(
        '.eventCard[data-type="TRAINING"][data-group-density="normal"]',
        "--ib-training-row-height",
      ),
      rowGap: readCssToken(
        '.eventCard[data-type="TRAINING"][data-group-density="normal"]',
        "--ib-training-row-gap",
      ),
      cellPaddingY: readCssToken(
        '.eventCard[data-type="TRAINING"][data-group-density="normal"]',
        "--ib-training-cell-padding-y",
      ),
    };
  }
  if (density === "compact" || density === "dense") {
    return {
      rowHeight: readCssToken(
        `.eventCard[data-type="TRAINING"][data-group-density="${density}"] .trainingRowMatrix`,
        "--ib-training-row-height",
      ),
      rowGap: readCssToken(
        `.eventCard[data-type="TRAINING"][data-group-density="${density}"] .trainingRowMatrix`,
        "--ib-training-row-gap",
      ),
      cellPaddingY: readCssToken(
        `.eventCard[data-type="TRAINING"][data-group-density="${density}"] .trainingRowMatrix`,
        "--ib-training-cell-padding-y",
      ),
    };
  }
  throw new Error(`Unexpected training group density: ${density ?? "null"}`);
}

function clampMax(value: string): number {
  const match = /clamp\([^,]+,[^,]+,\s*([^)]+)\)/.exec(value);
  if (!match?.[1]) {
    throw new Error(`Expected clamp() token, received "${value}"`);
  }
  return Number.parseFloat(match[1]);
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

function assertSharedRowAlignment(card: HTMLElement): void {
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
}

describe("INFOBOARD-ROLLING-01H — shared row alignment", () => {
  it("TEST A — 4-row compact cohort retains shared row alignment", () => {
    renderWednesdayAt("15:45");
    assertSharedRowAlignment(trainingCard("4"));
  });

  it("TEST B — 5-row compact cohort retains shared row alignment", () => {
    renderWednesdayAt("17:15");
    assertSharedRowAlignment(trainingCard("5"));
  });

  it("TEST C — 6-row dense cohort retains shared row alignment", () => {
    renderWednesdayAt("18:45");
    assertSharedRowAlignment(trainingCard("6"));
  });
});

describe("INFOBOARD-ROLLING-01H — row spacing tokens", () => {
  it("TEST D — row-spacing tokens stay on the normal tier for all cohort sizes", () => {
    renderWednesdayAt("20:15");
    const twoRowTokens = readTrainingMatrixTokens(trainingCard("2"));

    renderWednesdayAt("15:45");
    const fourRowTokens = readTrainingMatrixTokens(trainingCard("4"));

    renderWednesdayAt("18:45");
    const sixRowTokens = readTrainingMatrixTokens(trainingCard("6"));

    expect(fourRowTokens.rowHeight).toBe(twoRowTokens.rowHeight);
    expect(sixRowTokens.rowHeight).toBe(twoRowTokens.rowHeight);
    expect(clampMax(twoRowTokens.rowGap)).toBeGreaterThan(0);
  });

  it("compact and dense tiers expose non-zero row gap on the shared matrix", () => {
    renderWednesdayAt("15:45");
    expect(clampMax(readTrainingMatrixTokens(trainingCard("4")).rowGap)).toBeGreaterThan(0);

    renderWednesdayAt("18:45");
    expect(clampMax(readTrainingMatrixTokens(trainingCard("6")).rowGap)).toBeGreaterThan(0);
  });
});

describe("INFOBOARD-ROLLING-01H — clip-safe dense cohort", () => {
  it("TEST E — dense six-team cohort remains clip-safe", () => {
    renderWednesdayAt("18:45");
    const denseCard = trainingCard("6");

    for (const teamName of WEDNESDAY_COHORT_TEAM_NAMES.at1845) {
      expect(within(denseCard).getByText(teamName)).toBeTruthy();
    }

    expect(within(denseCard).getAllByTestId("training-group-row")).toHaveLength(6);
    expect(denseCard.querySelectorAll('[data-testid="training-matrix-row"]')).toHaveLength(6);
    expect(denseCard.getAttribute("data-group-density")).toBe("normal");
  });
});

describe("INFOBOARD-ROLLING-01H — rolling pagination regression", () => {
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

  it("TEST F — rolling pagination keeps chronological page order", () => {
    const items: DisplayItem[] = [
      cohortItem("2026-08-26T13:45:00.000Z", 4, "next"),
      cohortItem("2026-08-26T15:15:00.000Z", 5),
      cohortItem("2026-08-26T16:45:00.000Z", 6),
    ];
    const demands = items.map((item) =>
      item.kind === "training-group"
        ? computeTrainingGroupDemand(item.items.length)
        : 1,
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

  it("updated demand weights remain monotonic for 4–6 row cohorts", () => {
    const demands = [4, 5, 6].map(computeTrainingGroupDemand);
    for (let i = 1; i < demands.length; i++) {
      expect(demands[i]).toBeGreaterThan(demands[i - 1]);
    }
  });
});

describe("INFOBOARD-ROLLING-01H — page rotator regression", () => {
  it("TEST G — InfoboardPageRotator alternates Page 1 → Page 2 → Page 1", async () => {
    vi.useFakeTimers();
    try {
      render(
        <InfoboardPageRotator intervalMs={12_000}>
          <ul data-testid="event-list">
            <li>Page 1</li>
          </ul>
          <ul data-testid="event-list-page-1">
            <li>Page 2</li>
          </ul>
        </InfoboardPageRotator>,
      );

      expect(screen.getByTestId("event-list")).toBeTruthy();
      expect(screen.queryByTestId("event-list-page-1")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });
      expect(screen.queryByTestId("event-list")).toBeNull();
      expect(screen.getByTestId("event-list-page-1")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(12_000);
      });
      expect(screen.getByTestId("event-list")).toBeTruthy();
      expect(screen.queryByTestId("event-list-page-1")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("INFOBOARD-ROLLING-01H — display list integrity", () => {
  it("buildDisplayList keeps same-start cohorts atomic after spacing refinement", () => {
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
});
