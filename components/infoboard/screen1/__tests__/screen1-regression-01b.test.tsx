/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-KIOSK-VIEWPORT-01B — physical kiosk viewport hotfix regressions.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARD_DEMAND_PAGE_MAX,
  InfoboardScreen1,
  buildDisplayList,
  computeTrainingGroupDemand,
  layoutModeTier,
  paginateDisplayList,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";
import {
  buildThursday20260827Feed,
  resolveThursdayPreviewCurrentTimeIso,
  THURSDAY_COHORT_TEAM_NAMES,
} from "@/components/infoboard/screen1/thursday-2026-08-27-fixture";
import {
  buildWednesday20260826Feed,
  resolveWednesdayPreviewCurrentTimeIso,
} from "@/components/infoboard/screen1/wednesday-2026-08-26-fixture";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_FIXTURE_TOURNAMENT_4TEAM,
  PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardScreen1Event, InfoboardScreen1Feed } from "@/lib/publishing/event-types";

const SCREEN1_CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../InfoboardScreen1.module.css"),
  "utf8",
);

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

function cssBlock(selector: string): string {
  const start = SCREEN1_CSS.indexOf(selector);
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  return SCREEN1_CSS.slice(start, SCREEN1_CSS.indexOf("}", start));
}

function flatItems(feed: InfoboardScreen1Feed): FlatEvent[] {
  return [
    ...feed.current.map((event) => ({ event, temporal: "current" as const })),
    ...feed.next.map((event) => ({ event, temporal: "next" as const })),
    ...feed.later.map((event) => ({ event, temporal: "later" as const })),
  ];
}

function pageDemand(items: DisplayItem[]): number {
  return items.reduce((sum, item) => {
    if (item.kind === "training-group") {
      return sum + computeTrainingGroupDemand(item.items.length);
    }
    return sum + 2.2;
  }, 0);
}

function renderThursday(at: keyof typeof import("@/components/infoboard/screen1/thursday-2026-08-27-fixture").THURSDAY_2026_08_27_PREVIEW_TIMES = "14:00") {
  const nowIso = resolveThursdayPreviewCurrentTimeIso(at);
  return render(
    <KioskViewportScaler>
      <InfoboardScreen1
        feed={buildThursday20260827Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
        announcement={{ enabled: true, text: "Footer regression" }}
      />
    </KioskViewportScaler>,
  );
}

afterEach(() => {
  cleanup();
});

describe("INFOBOARD-KIOSK-VIEWPORT-01B — Thursday dense page", () => {
  it("A — 17:15 + 18:45 + 20:15 cohorts stay on one footer-safe page", () => {
    const nowIso = resolveThursdayPreviewCurrentTimeIso("14:00");
    const feed = buildThursday20260827Feed(nowIso);
    const items = buildDisplayList(flatItems(feed));
    const demands = items.map((item) =>
      item.kind === "training-group"
        ? computeTrainingGroupDemand(item.items.length)
        : 2.2,
    );

    expect(items).toHaveLength(3);
    expect(demands.reduce((sum, demand) => sum + demand, 0)).toBeLessThanOrEqual(
      CARD_DEMAND_PAGE_MAX,
    );
    expect(paginateDisplayList(items, demands)).toHaveLength(1);
  });

  it("B/C — Junioren B2 and footer render on the same single page", () => {
    renderThursday("14:00");

    expect(screen.queryByTestId("infoboard-page-rotator")).toBeNull();
    expect(screen.getByText("JUNIOREN B2")).toBeTruthy();
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.getByTestId("infoboard-content-region").nextElementSibling).toBe(
      screen.getByTestId("announcement-bar"),
    );
  });

  it("D — content region and footer do not overlap in the shell grid", () => {
    renderThursday("14:00");
    const root = screen.getByTestId("infoboard-screen1-root");
    const main = screen.getByTestId("infoboard-content-region");
    const footer = screen.getByTestId("announcement-bar");

    expect(root.lastElementChild).toBe(footer);
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cssBlock(".root {\n  display: grid")).toContain(
      "grid-template-rows: auto minmax(0, 1fr) auto",
    );
  });

  it("E — sparse single-card day remains bounded (layout-mode sparse)", () => {
    const nowIso = resolveThursdayPreviewCurrentTimeIso("14:00");
    const source = buildThursday20260827Feed(nowIso);
    render(
      <InfoboardScreen1
        feed={{
          ...source,
          current: [],
          next: [source.next[0]!],
          later: [],
          isEmpty: false,
          emptyStateReason: null,
        }}
        branding={BRANDING}
        currentTimeIso={nowIso}
        liveClock={false}
      />,
    );
    expect(screen.getByTestId("event-list").getAttribute("data-layout-mode")).toBe("sparse");
  });

  it("F — match card day remains stable", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE}
        branding={BRANDING}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        liveClock={false}
      />,
    );
    expect(screen.getAllByTestId("event-row").some(
      (row) => row.getAttribute("data-type") === "MATCH",
    )).toBe(true);
  });

  it("G — tournament card day remains stable", () => {
    render(
      <InfoboardScreen1
        feed={PREVIEW_FIXTURE_TOURNAMENT_4TEAM}
        branding={BRANDING}
        currentTimeIso={PREVIEW_FIXTURE_TOURNAMENT_4TEAM.generatedAt}
        liveClock={false}
        eventPresentation={PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS}
      />,
    );
    expect(screen.getAllByTestId("event-row").some(
      (row) => row.getAttribute("data-type") === "TOURNAMENT",
    )).toBe(true);
  });

  it("H — multi-page rotator day remains stable", () => {
    const nowIso = resolveWednesdayPreviewCurrentTimeIso("11:00");
    render(
      <InfoboardScreen1
        feed={buildWednesday20260826Feed(nowIso)}
        branding={BRANDING}
        currentTimeIso={nowIso}
      />,
    );
    expect(screen.getByTestId("infoboard-page-rotator").getAttribute("data-page-count")).toBe("3");
  });

  it("I — kiosk viewport scaler exposes the logical canvas contract", () => {
    render(
      <KioskViewportScaler>
        <div data-testid="canvas-child">child</div>
      </KioskViewportScaler>,
    );
    expect(screen.getByTestId("kiosk-viewport-scaler")).toBeTruthy();
    expect(screen.getByTestId("kiosk-viewport-canvas").getAttribute("data-kiosk-viewport-canvas")).toBe(
      "true",
    );
  });

  it("J — fill-mode cards use proportional flex distribution", () => {
    expect(cssBlock(".eventList[data-layout-mode=\"fill\"] .eventCard {")).toContain(
      "flex: var(--ib-card-demand, 1) 1 0",
    );
    expect(cssBlock(":global([data-kiosk-viewport-canvas=\"true\"]) .root {")).toContain(
      "height: 100%",
    );
  });
});

describe("INFOBOARD-KIOSK-VIEWPORT-01B — Thursday cohort visibility", () => {
  it("renders all required cohort labels including Junioren B2", () => {
    renderThursday("14:00");

    for (const teamName of THURSDAY_COHORT_TEAM_NAMES.at1715) {
      expect(screen.getByText(teamName)).toBeTruthy();
    }
    for (const teamName of THURSDAY_COHORT_TEAM_NAMES.at1845) {
      expect(screen.getByText(teamName)).toBeTruthy();
    }
    for (const teamName of THURSDAY_COHORT_TEAM_NAMES.at2015) {
      expect(screen.getByText(teamName)).toBeTruthy();
    }

    expect(screen.getAllByTestId("training-cohort-start-time").map(
      (node) => node.textContent,
    )).toEqual(["17:15", "18:45", "20:15"]);
  });

  it("keeps the 20:15 three-row matrix intact", () => {
    renderThursday("14:00");
    const card = screen.getAllByTestId("event-row").find(
      (row) => row.getAttribute("data-training-count") === "3",
    );
    expect(card).toBeTruthy();
    expect(card?.getAttribute("data-group-density")).toBe("normal");
    expect(within(card!).getAllByTestId("training-matrix-row")).toHaveLength(3);
    expect(within(card!).getByText("JUNIOREN B2")).toBeTruthy();
  });

  it("uses fill layout mode for the dense Thursday page", () => {
    renderThursday("14:00");
    const list = screen.getByTestId("event-list");
    const feed = buildThursday20260827Feed(resolveThursdayPreviewCurrentTimeIso("14:00"));
    const items = buildDisplayList(flatItems(feed));

    expect(list.getAttribute("data-layout-mode")).toBe("fill");
    expect(layoutModeTier(pageDemand(items))).toBe("fill");
    expect(list.getAttribute("data-count")).toBe("3");
  });
});
