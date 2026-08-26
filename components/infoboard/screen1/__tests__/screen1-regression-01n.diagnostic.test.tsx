/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01N — production feed eligibility and rolling-page trace.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CARD_DEMAND_PAGE_MAX,
  InfoboardScreen1,
  buildDisplayList,
  computeEventDemand,
  computeMatchDemand,
  computeTrainingGroupDemand,
  paginateDisplayList,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  WEDNESDAY_2026_08_26_ALL_EVENTS,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import { buildInfoboardScreen1Feed } from "@/lib/publishing/infoboard/screen1-feed-builder";
import type { Screen1SourceEvent } from "@/lib/publishing/infoboard/screen1-event-mapper";
import {
  getScreen1LifecyclePhase,
  isScreen1LifecycleEligibleAt,
} from "@/lib/publishing/infoboard/screen1-event-lifecycle";
import { filterExpiredScreen1Feed } from "@/lib/publishing/infoboard/screen1-feed-expiry";

const AT_1457 = "2026-08-26T12:57:00.000Z";
const AT_1815 = "2026-08-26T16:15:00.000Z";
const BRANDING = { clubLogoSrc: null, productLogoSrc: null };

const TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC ALLSCHWIL",
  timezone: "Europe/Zurich",
} as const;

const SOURCE_EVENTS: Screen1SourceEvent[] = WEDNESDAY_2026_08_26_ALL_EVENTS.map(
  (event) => ({
    id: event.id,
    tenantId: TENANT.id,
    type: event.type,
    status: event.status,
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: event.type === "MATCH" ? "HOME" : null,
    startAt: new Date(event.startAt),
    endAt: event.endAt === null ? null : new Date(event.endAt),
    title: event.displayTitle,
    seasonKey: event.seasonKey,
    team: { infoboardDisplayName: event.teamDisplayName },
    opponentFallbackName: event.opponentDisplayName,
    competitionLabel: event.competitionLabel,
  }),
);

async function buildProductionFeed(nowIso: string): Promise<InfoboardScreen1Feed> {
  return buildInfoboardScreen1Feed(async () => SOURCE_EVENTS, {
    tenant: TENANT,
    timeZone: TENANT.timezone,
    now: new Date(nowIso),
  });
}

function displayItems(feed: InfoboardScreen1Feed): DisplayItem[] {
  const flatList: FlatEvent[] = [
    ...feed.current.map((event) => ({ event, temporal: "current" as const })),
    ...feed.next.map((event) => ({ event, temporal: "next" as const })),
    ...feed.later.map((event) => ({ event, temporal: "later" as const })),
  ];
  return buildDisplayList(flatList);
}

function itemTime(item: DisplayItem): string {
  const startAt =
    item.kind === "training-group"
      ? item.items[0]!.event.startAt
      : item.item.event.startAt;
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TENANT.timezone,
  }).format(new Date(startAt));
}

function itemDemand(item: DisplayItem): number {
  if (item.kind === "training-group") {
    return computeTrainingGroupDemand(item.items.length);
  }
  if (item.item.event.type === "MATCH") {
    return computeMatchDemand(item.item.event);
  }
  return computeEventDemand(item.item.event.type);
}

function activeTimes(): string[] {
  const root =
    screen.queryByTestId("infoboard-page-rotator")
    ?? screen.queryByTestId("event-list");
  if (root === null) return [];
  return Array.from(root.querySelectorAll("time"), (node) => node.textContent ?? "");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("INFOBOARD-ROLLING-01N diagnostic pipeline", () => {
  it("TEST A — 14:57 excludes 20:15 from the production rolling feed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(AT_1457));
    const feed = await buildProductionFeed(AT_1457);
    const visibleFeed = filterExpiredScreen1Feed(feed, new Date(AT_1457));
    const items = displayItems(visibleFeed);
    const demands = items.map(itemDemand);
    const pages = paginateDisplayList(items, demands);
    const event2015 = WEDNESDAY_2026_08_26_ALL_EVENTS.find(
      (event) => event.id === "wed-s30",
    )!;

    // Lifecycle eligibility means "not expired"; production admission is
    // separately bounded by the four-hour rolling feed horizon.
    expect(getScreen1LifecyclePhase(event2015, new Date(AT_1457))).toBe("pre-event");
    expect(isScreen1LifecycleEligibleAt(event2015, new Date(AT_1457))).toBe(true);
    expect([
      ...visibleFeed.current,
      ...visibleFeed.next,
      ...visibleFeed.later,
    ].map((event) => event.id)).not.toContain("wed-s30");
    expect(items.map(itemTime)).toEqual(["15:45", "17:15", "18:45"]);
    expect(demands).toEqual([3.6, 4.25, 4.9]);
    expect(pages.map((page) => page.map(itemTime))).toEqual([
      ["15:45", "17:15"],
      ["18:45"],
    ]);

    render(
      <InfoboardScreen1
        feed={feed}
        currentTimeIso={AT_1457}
        branding={BRANDING}
      />,
    );
    const rotator = screen.getByTestId("infoboard-page-rotator");
    expect(rotator.dataset.pageCount).toBe("2");

    const sequence = [activeTimes()];
    for (let elapsed = 12_000; elapsed <= 48_000; elapsed += 12_000) {
      await act(async () => vi.advanceTimersByTime(12_000));
      sequence.push(activeTimes());
    }
    expect(sequence).toEqual([
      ["15:45", "17:15"],
      ["18:45"],
      ["15:45", "17:15"],
      ["18:45"],
      ["15:45", "17:15"],
    ]);
  });

  it("TEST B/C/D — 18:15 admits 20:15 and rotates all three pages across refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(AT_1815));
    const feed = await buildProductionFeed(AT_1815);
    const refreshFeed = await buildProductionFeed("2026-08-26T16:15:18.000Z");
    const items = displayItems(feed);
    const demands = items.map(itemDemand);
    const pages = paginateDisplayList(items, demands, CARD_DEMAND_PAGE_MAX);

    expect(items.map(itemTime)).toEqual(["15:45", "17:15", "18:45", "19:45", "20:15"]);
    expect(demands).toHaveLength(5);
    [1.55, 4.25, 4.9, 2.32, 2.1].forEach((expected, index) => {
      expect(demands[index]).toBeCloseTo(expected);
    });
    expect(pages.map((page) => page.map(itemTime))).toEqual([
      ["15:45", "17:15"],
      ["18:45", "19:45"],
      ["20:15"],
    ]);
    expect(pages.flat().filter((item) => itemTime(item) === "20:15")).toHaveLength(1);

    const view = render(
      <InfoboardScreen1
        feed={feed}
        currentTimeIso={AT_1815}
        branding={BRANDING}
      />,
    );
    const rotator = screen.getByTestId("infoboard-page-rotator");
    expect(rotator.dataset.pageCount).toBe("3");
    expect(activeTimes()).toEqual(["15:45", "17:15"]);

    await act(async () => vi.advanceTimersByTime(12_000));
    expect(activeTimes()).toEqual(["18:45", "19:45"]);

    await act(async () => vi.advanceTimersByTime(6_000));
    view.rerender(
      <InfoboardScreen1
        feed={refreshFeed}
        currentTimeIso={AT_1815}
        branding={BRANDING}
      />,
    );
    expect(screen.getByTestId("infoboard-page-rotator")).toBe(rotator);

    await act(async () => vi.advanceTimersByTime(6_000));
    expect(activeTimes()).toEqual(["20:15"]);

    await act(async () => vi.advanceTimersByTime(12_000));
    expect(activeTimes()).toEqual(["15:45", "17:15"]);
  });

  it("TEST E — lifecycle repacking keeps page indices valid across 3 → 2 → 1 pages", async () => {
    const at1815 = await buildProductionFeed(AT_1815);
    const at1846 = await buildProductionFeed("2026-08-26T16:46:00.000Z");
    const at2016 = await buildProductionFeed("2026-08-26T18:16:00.000Z");
    const view = render(
      <InfoboardScreen1 feed={at1815} currentTimeIso={AT_1815} branding={BRANDING} />,
    );

    expect(screen.getByTestId("infoboard-page-rotator").dataset.pageCount).toBe("3");

    view.rerender(
      <InfoboardScreen1
        feed={at1846}
        currentTimeIso="2026-08-26T16:46:00.000Z"
        branding={BRANDING}
      />,
    );
    expect(screen.getByTestId("infoboard-page-rotator").dataset.pageCount).toBe("2");
    expect(screen.getByTestId("infoboard-page-rotator").dataset.activePage).toBe("0");

    view.rerender(
      <InfoboardScreen1
        feed={at2016}
        currentTimeIso="2026-08-26T18:16:00.000Z"
        branding={BRANDING}
      />,
    );
    expect(screen.queryByTestId("infoboard-page-rotator")).toBeNull();
    expect(activeTimes()).toEqual(["19:45", "20:15"]);
  });
});
