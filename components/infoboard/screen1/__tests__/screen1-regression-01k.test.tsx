/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01K — physical-TV footer safe-area regression.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARD_DEMAND_PAGE_MAX,
  InfoboardScreen1,
  computeMatchDemand,
  computeTrainingGroupDemand,
  paginateDisplayList,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardPageRotator } from "@/components/infoboard/screen1/InfoboardPageRotator";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../InfoboardScreen1.module.css"),
  "utf8",
);

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

function trainingCohort(label: string, startAt: string, rowCount: number): DisplayItem {
  const items: FlatEvent[] = Array.from({ length: rowCount }, (_, index) => ({
    temporal: "later",
    event: {
      id: `${label}-${index}`,
      type: "TRAINING",
      startAt,
      endAt: "2026-08-26T20:00:00.000Z",
      teamDisplayName: `${label} TEAM ${index + 1}`,
    } as InfoboardScreen1Event,
  }));
  return { kind: "training-group", items, temporal: "later" };
}

function matchItem(label: string, startAt: string): DisplayItem {
  return {
    kind: "event",
    item: {
      temporal: "later",
      event: {
        id: label,
        type: "MATCH",
        startAt,
        endAt: "2026-08-26T19:45:00.000Z",
        teamDisplayName: label,
      } as InfoboardScreen1Event,
    },
  };
}

function wednesdayItems(): { items: DisplayItem[]; demands: number[] } {
  const items = [
    trainingCohort("15:45", "2026-08-26T13:45:00.000Z", 4),
    trainingCohort("17:15", "2026-08-26T15:15:00.000Z", 5),
    trainingCohort("18:45", "2026-08-26T16:45:00.000Z", 6),
    matchItem("19:45", "2026-08-26T17:45:00.000Z"),
    trainingCohort("20:15", "2026-08-26T18:15:00.000Z", 2),
  ];
  const demands = items.map((item) =>
    item.kind === "training-group"
      ? computeTrainingGroupDemand(item.items.length)
      : computeMatchDemand(item.item.event),
  );
  return { items, demands };
}

function itemLabel(item: DisplayItem): string {
  return item.kind === "training-group"
    ? item.items[0]!.event.id.split("-")[0]!
    : item.item.event.id;
}

function cssBlock(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

function clampMax(block: string, token: string): number {
  const value = new RegExp(`${token}:\\s*clamp\\([^,]+,[^,]+,\\s*([\\d.]+)px\\)`)
    .exec(block)?.[1];
  expect(value, `Missing ${token}`).toBeTruthy();
  return Number(value);
}

function activePageTimes(): string[] {
  const page =
    screen.queryByTestId("infoboard-page-rotator")?.querySelector("ul")
    ?? screen.getByTestId("event-list");
  return Array.from(page.querySelectorAll("time"), (time) => time.textContent ?? "");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("INFOBOARD-ROLLING-01K — footer-safe pagination", () => {
  it("TEST A — reserves a bounded content row above the footer", () => {
    const nowIso = resolveWednesdayPreviewCurrentTimeIso("11:00");
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
        announcement={{ enabled: true, text: "Ticker" }}
      />,
    );

    const root = screen.getByTestId("infoboard-screen1-root");
    const main = screen.getByTestId("infoboard-content-region");
    const footer = screen.getByTestId("announcement-bar");
    expect(main.nextElementSibling).toBe(footer);
    expect(root.lastElementChild).toBe(footer);
    expect(main.getAttribute("data-safe-page-capacity")).toBe("8.50");

    const rootCss = cssBlock(".root {\n  display: grid");
    const mainCss = cssBlock(".main {");
    expect(rootCss).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(rootCss).toContain("height: 100svh");
    expect(rootCss).not.toContain("min-height: 100vh");
    expect(mainCss).toContain("min-height: 0");
    expect(mainCss).toContain("max-height: 100%");
  });

  it("TEST B — rejects dense Wednesday Page 2 when demand exceeds safe capacity", () => {
    const { items, demands } = wednesdayItems();
    const pages = paginateDisplayList(items, demands);
    const denseTailDemand = demands[2]! + demands[3]! + demands[4]!;

    expect(denseTailDemand).toBeGreaterThan(CARD_DEMAND_PAGE_MAX);
    expect(pages.map((page) => page.map(itemLabel))).toEqual([
      ["15:45", "17:15"],
      ["18:45", "19:45"],
      ["20:15"],
    ]);
  });

  it("TEST C — keeps consecutive chronological pagination without leapfrogging", () => {
    const { items, demands } = wednesdayItems();
    const pages = paginateDisplayList(items, demands);
    expect(pages.flat().map(itemLabel)).toEqual([
      "15:45",
      "17:15",
      "18:45",
      "19:45",
      "20:15",
    ]);
  });

  it("TEST D — keeps the six-row 18:45 cohort atomic", () => {
    const { items, demands } = wednesdayItems();
    const pages = paginateDisplayList(items, demands);
    const cohort = pages.flat().find((item) => itemLabel(item) === "18:45");
    expect(cohort?.kind).toBe("training-group");
    if (cohort?.kind === "training-group") {
      expect(cohort.items).toHaveLength(6);
    }
  });

  it("TEST E — rotates Page 1 → Page 2 → Page 3 → Page 1 every 12 seconds", async () => {
    vi.useFakeTimers();
    render(
      <InfoboardPageRotator intervalMs={12_000} contentKey="three-pages">
        <div>Page 1</div>
        <div>Page 2</div>
        <div>Page 3</div>
      </InfoboardPageRotator>,
    );

    for (const expected of ["Page 1", "Page 2", "Page 3", "Page 1"]) {
      expect(screen.getByText(expected)).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(12_000));
    }
  });

  it("TEST F — lifecycle removal repacks remaining cohorts and restarts at Page 1", async () => {
    vi.useFakeTimers();
    const nowIso = resolveWednesdayPreviewCurrentTimeIso("11:00");
    const feed = buildWednesday20260826Feed(nowIso);
    const view = render(
      <InfoboardScreen1
        feed={feed}
        branding={BRANDING}
        currentTimeIso={nowIso}
        liveClock={false}
      />,
    );

    await act(async () => vi.advanceTimersByTime(12_000));
    expect(activePageTimes()).toEqual(["18:45", "19:45"]);

    const without1545 = {
      ...feed,
      current: feed.current.filter((event) => !event.id.startsWith("wed-e3")),
      next: feed.next.filter((event) => event.startAt !== "2026-08-26T13:45:00.000Z"),
      later: feed.later.filter((event) => event.startAt !== "2026-08-26T13:45:00.000Z"),
    };
    view.rerender(
      <InfoboardScreen1
        feed={without1545}
        branding={BRANDING}
        currentTimeIso={nowIso}
        liveClock={false}
      />,
    );
    await act(async () => {});

    expect(activePageTimes()).toEqual(["17:15", "18:45"]);
  });

  it("TEST G — converges to one page and removes the rotator when late content fits", () => {
    const nowIso = resolveWednesdayPreviewCurrentTimeIso("20:15");
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
      />,
    );

    expect(screen.queryByTestId("infoboard-page-rotator")).toBeNull();
    expect(activePageTimes()).toEqual(["19:45", "20:15"]);
  });

  it("TEST H — preserves non-zero normal > compact > dense row spacing", () => {
    const normal = cssBlock(
      '.eventCard[data-type="TRAINING"][data-group-density="normal"]',
    );
    const compact = cssBlock(
      '.eventCard[data-type="TRAINING"][data-group-density="compact"] .trainingRowMatrix',
    );
    const dense = cssBlock(
      '.eventCard[data-type="TRAINING"][data-group-density="dense"] .trainingRowMatrix',
    );
    const spacing = (block: string) =>
      clampMax(block, "--ib-training-row-height")
      + clampMax(block, "--ib-training-row-gap")
      + clampMax(block, "--ib-training-cell-padding-y") * 2;

    expect(spacing(normal)).toBeGreaterThan(spacing(compact));
    expect(spacing(compact)).toBeGreaterThan(spacing(dense));
    expect(clampMax(normal, "--ib-training-row-gap")).toBeGreaterThan(0);
    expect(clampMax(compact, "--ib-training-row-gap")).toBeGreaterThan(0);
    expect(clampMax(dense, "--ib-training-row-gap")).toBeGreaterThan(0);
  });

  it.each([
    ["15:45", "4"],
    ["17:15", "5"],
    ["18:45", "6"],
  ] as const)("TEST I — %s cohort matrix row drift remains <= 1px", (at, count) => {
    const nowIso = resolveWednesdayPreviewCurrentTimeIso(at);
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
      />,
    );
    const card = screen.getAllByTestId("event-row").find(
      (row) => row.getAttribute("data-training-count") === count,
    );
    expect(card).toBeTruthy();
    const rows = Array.from(card!.querySelectorAll('[data-testid="training-matrix-row"]'));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockRect(this: HTMLElement) {
        const row = this.closest('[data-testid="training-matrix-row"]');
        const rowIndex = row === null ? 0 : rows.indexOf(row);
        const top = 100 + rowIndex * 40;
        return {
          top,
          bottom: top + 40,
          left: 0,
          right: 100,
          width: 100,
          height: 40,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );

    for (const row of rows) {
      const centers = Array.from(
        row.querySelectorAll<HTMLElement>('[class*="trainingMatrixCell"]'),
        (cell) => {
          const rect = cell.getBoundingClientRect();
          return rect.top + rect.height / 2;
        },
      );
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    }
  });
});
