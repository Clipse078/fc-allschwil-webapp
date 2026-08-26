/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01L — normal-density two-row training spacing.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
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
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "@/lib/publishing/event-types";

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../InfoboardScreen1.module.css"),
  "utf8",
);

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

const NORMAL_SELECTOR =
  '.eventCard[data-type="TRAINING"][data-group-density="normal"]';
const COMPACT_SELECTOR =
  '.eventCard[data-type="TRAINING"][data-group-density="compact"] .trainingRowMatrix';
const DENSE_SELECTOR =
  '.eventCard[data-type="TRAINING"][data-group-density="dense"] .trainingRowMatrix';

function cssToken(selector: string, token: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  const block = CSS.slice(start, CSS.indexOf("}", start));
  const value = new RegExp(`${token}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
  expect(value, `Missing ${token} in ${selector}`).toBeTruthy();
  return value!;
}

function clampMax(value: string): number {
  const max = /clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/.exec(value)?.[1];
  expect(max, `Expected pixel clamp maximum in ${value}`).toBeTruthy();
  return Number(max);
}

function trainingCard(count: string): HTMLElement {
  const card = screen.getAllByTestId("event-row").find(
    (row) =>
      row.getAttribute("data-type") === "TRAINING"
      && row.getAttribute("data-training-count") === count,
  );
  expect(card).toBeTruthy();
  return card!;
}

function twoRow2015Feed(): {
  nowIso: string;
  feed: InfoboardScreen1Feed;
} {
  const nowIso = resolveWednesdayPreviewCurrentTimeIso("20:15");
  const source = buildWednesday20260826Feed(nowIso);
  const events = [...source.current, ...source.next, ...source.later];
  const juniorenA = events.find((event) => event.id === "wed-ja");
  const senioren30 = events.find((event) => event.id === "wed-s30");
  expect(juniorenA).toBeTruthy();
  expect(senioren30).toBeTruthy();

  const withAllocation = (
    event: InfoboardScreen1Event,
    dressingRoomLabel: string,
    pitchLabel: string,
  ): InfoboardScreen1Event => ({
    ...event,
    allocation: {
      ...event.allocation,
      homeDressingRoomLabel: dressingRoomLabel,
      pitchLabel,
    },
  });

  return {
    nowIso,
    feed: {
      ...source,
      current: [
        withAllocation(juniorenA!, "Kabine 02", "KR 2 - FELD B"),
        withAllocation(senioren30!, "Kabine 03", "KR 2 - FELD A"),
      ],
      next: [],
      later: [],
      isEmpty: false,
      emptyStateReason: null,
    },
  };
}

function renderTwoRow2015(): HTMLElement {
  const { nowIso, feed } = twoRow2015Feed();
  render(
    <InfoboardScreen1
      feed={feed}
      branding={BRANDING}
      currentTimeIso={nowIso}
    />,
  );
  return trainingCard("2");
}

function cohortItem(label: string, startAt: string, rowCount: number): DisplayItem {
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

function matchItem(): DisplayItem {
  return {
    kind: "event",
    item: {
      temporal: "later",
      event: {
        id: "19:45",
        type: "MATCH",
        startAt: "2026-08-26T17:45:00.000Z",
        endAt: "2026-08-26T19:45:00.000Z",
        teamDisplayName: "1. MANNSCHAFT",
      } as InfoboardScreen1Event,
    },
  };
}

function itemLabel(item: DisplayItem): string {
  return item.kind === "training-group"
    ? item.items[0]!.event.id.split("-")[0]!
    : item.item.event.id;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("INFOBOARD-ROLLING-01L — normal two-row matrix", () => {
  it("TEST A — normal density increases shared row height and gap", () => {
    expect(cssToken(NORMAL_SELECTOR, "--ib-training-row-height")).toBe(
      "clamp(52px, 6vh, 68px)",
    );
    expect(cssToken(NORMAL_SELECTOR, "--ib-training-row-gap")).toBe(
      "clamp(8px, 0.9vh, 12px)",
    );
    expect(cssToken(NORMAL_SELECTOR, "--ib-training-cell-padding-y")).toBe(
      "clamp(3px, 0.4vh, 7px)",
    );

    expect(clampMax(cssToken(NORMAL_SELECTOR, "--ib-training-row-height"))).toBeGreaterThan(48);
    expect(clampMax(cssToken(NORMAL_SELECTOR, "--ib-training-row-gap"))).toBeGreaterThan(7);
  });

  it("TEST B — 20:15 renders both complete TRAINING / KABINE / PLATZ rows", () => {
    const card = renderTwoRow2015();
    expect(card.getAttribute("data-group-density")).toBe("normal");

    const rows = within(card).getAllByTestId("training-matrix-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("JUNIOREN A");
    expect(rows[0]).toHaveTextContent("02");
    expect(rows[0]).toHaveTextContent("KR 2 - FELD B");
    expect(rows[1]).toHaveTextContent("SENIOREN 30+");
    expect(rows[1]).toHaveTextContent("03");
    expect(rows[1]).toHaveTextContent("KR 2 - FELD A");
  });

  it("TEST C — both 20:15 rows keep TRAINING/KABINE/PLATZ center drift <= 1px", () => {
    const card = renderTwoRow2015();
    const rows = within(card).getAllByTestId("training-matrix-row");

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockRect(this: HTMLElement) {
        const row = this.closest('[data-testid="training-matrix-row"]');
        const rowIndex = row instanceof HTMLElement ? rows.indexOf(row) : 0;
        const top = 200 + rowIndex * 80;
        return {
          top,
          bottom: top + 68,
          left: 0,
          right: 100,
          width: 100,
          height: 68,
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
      expect(centers).toHaveLength(3);
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    }
  });

  it("TEST D — spacing hierarchy remains normal > compact > dense", () => {
    const spacing = (selector: string) =>
      clampMax(cssToken(selector, "--ib-training-row-height"))
      + clampMax(cssToken(selector, "--ib-training-row-gap"))
      + clampMax(cssToken(selector, "--ib-training-cell-padding-y")) * 2;

    expect(spacing(NORMAL_SELECTOR)).toBeGreaterThan(spacing(COMPACT_SELECTOR));
    expect(spacing(COMPACT_SELECTOR)).toBeGreaterThan(spacing(DENSE_SELECTOR));
  });

  it.each([
    ["15:45", "4", "compact"],
    ["17:15", "5", "compact"],
    ["18:45", "6", "dense"],
  ] as const)("TEST E — %s cohort preserves its accepted %s-row density", (at, count, density) => {
    const nowIso = resolveWednesdayPreviewCurrentTimeIso(at);
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
      />,
    );
    expect(trainingCard(count).getAttribute("data-group-density")).toBe(density);
  });

  it("TEST F — Wednesday pagination remains P1 15:45/17:15, P2 18:45/19:45, P3 20:15", () => {
    const items = [
      cohortItem("15:45", "2026-08-26T13:45:00.000Z", 4),
      cohortItem("17:15", "2026-08-26T15:15:00.000Z", 5),
      cohortItem("18:45", "2026-08-26T16:45:00.000Z", 6),
      matchItem(),
      cohortItem("20:15", "2026-08-26T18:15:00.000Z", 2),
    ];
    const demands = items.map((item) =>
      item.kind === "training-group"
        ? computeTrainingGroupDemand(item.items.length)
        : computeMatchDemand(item.item.event),
    );

    expect(paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX).map(
      (page) => page.map(itemLabel),
    )).toEqual([
      ["15:45", "17:15"],
      ["18:45", "19:45"],
      ["20:15"],
    ]);
  });

  it("TEST G — rendered Page 3 remains inside the footer-safe main region", async () => {
    vi.useFakeTimers();
    const nowIso = resolveWednesdayPreviewCurrentTimeIso("11:00");
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
        announcement={{ enabled: true, text: "Footer safe" }}
      />,
    );

    await act(async () => vi.advanceTimersByTime(24_000));
    const card = trainingCard("2");
    const footer = screen.getByTestId("announcement-bar");
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      top: 220,
      bottom: 700,
      left: 0,
      right: 1920,
      width: 1920,
      height: 480,
      x: 0,
      y: 220,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(footer, "getBoundingClientRect").mockReturnValue({
      top: 760,
      bottom: 820,
      left: 0,
      right: 1920,
      width: 1920,
      height: 60,
      x: 0,
      y: 760,
      toJSON: () => ({}),
    } as DOMRect);

    expect(within(card).getByTestId("training-cohort-start-time")).toHaveTextContent("20:15");
    expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      footer.getBoundingClientRect().top,
    );
  });

  it("TEST H — three-page rotator remains P1 → P2 → P3 → P1", async () => {
    vi.useFakeTimers();
    render(
      <InfoboardPageRotator intervalMs={12_000} contentKey="01l-three-pages">
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
});
