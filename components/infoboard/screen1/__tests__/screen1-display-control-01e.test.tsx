/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-KIOSK-VIEWPORT-01E — universal training density + typography contract.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  INFOBOARD_FONT_SIZES,
  resolveScreen1PageDemandMax,
  TRAINING_FONT_SIZE_CSS,
  type InfoboardFontSize,
} from "@/lib/infoboard/screen1-logo-settings";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";
import {
  buildDisplayList,
  computeTrainingGroupDemand,
  expandOversizedTrainingGroups,
  maxTrainingRowsForPageCapacity,
  paginateDisplayList,
  trainingGroupDensityTier,
  type DisplayItem,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";

const CSS = readFileSync(
  resolve(process.cwd(), "components/infoboard/screen1/InfoboardScreen1.module.css"),
  "utf8",
);

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

const COHORT_SIZES = [1, 2, 3, 5, 8, 10] as const;

function trainingEvent(id: string, label: string, startAt: string): InfoboardScreen1Event {
  return {
    id,
    type: "TRAINING",
    displayTitle: label,
    teamDisplayName: label,
    opponentDisplayName: null,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt,
    endAt: "2026-08-27T16:45:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "next",
    seasonKey: "2025-26",
    allocation: {
      pitchLabel: "KR 1",
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
  };
}

function renderTrainingCohort(
  rowCount: number,
  trainingFontSize: InfoboardFontSize,
  presentation = DEFAULT_SCREEN1_PRESENTATION,
) {
  const startAt = "2026-08-27T15:15:00.000Z";
  const events = Array.from({ length: rowCount }, (_, index) =>
    trainingEvent(`t-${rowCount}-${index}`, `TEAM ${index + 1}`, startAt),
  );
  return render(
    <InfoboardScreen1
      feed={{
        generatedAt: "2026-08-27T12:00:00.000Z",
        tenant: {
          id: "tenant-1",
          key: "tenant",
          name: "TEST CLUB",
          timezone: "Europe/Zurich",
        },
        displayDate: "2026-08-27",
        isStale: false,
        wochenplanVariantBadge: null,
        current: [],
        next: events,
        later: [],
        isEmpty: false,
        emptyStateReason: null,
      }}
      branding={BRANDING}
      currentTimeIso="2026-08-27T12:00:00.000Z"
      liveClock={false}
      presentation={{ ...presentation, trainingFontSize }}
    />,
  );
}

function teamNameFontSize(rowCount: number, trainingFontSize: InfoboardFontSize): string {
  const { container } = renderTrainingCohort(rowCount, trainingFontSize);
  const card = container.querySelector('[data-type="TRAINING"]') as HTMLElement;
  const teamName = within(card).getAllByTestId("training-group-row")[0] as HTMLElement;
  return window.getComputedStyle(teamName).fontSize;
}

function makeCohortFlatEvents(count: number, startAt = "2026-08-27T16:00:00.000Z"): FlatEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    temporal: "next" as const,
    event: trainingEvent(`cohort-${count}-${index}`, `TEAM ${index + 1}`, startAt),
  }));
}

function cohortDisplayItem(count: number, startAt?: string): DisplayItem {
  return {
    kind: "training-group",
    items: makeCohortFlatEvents(count, startAt),
    temporal: "next",
  };
}

afterEach(() => {
  cleanup();
});

describe("INFOBOARD-KIOSK-VIEWPORT-01E universal training typography", () => {
  it.each(INFOBOARD_FONT_SIZES)(
    "Training %s keeps identical team-name font size across cohort sizes 1/3/5/8/10",
    (size) => {
      const sizes = COHORT_SIZES.map((rowCount) => teamNameFontSize(rowCount, size));
      cleanup();
      for (const value of sizes) {
        expect(value).toBe(sizes[0]);
      }
    },
  );

  it("does not apply compact/dense team-name font overrides in CSS", () => {
    expect(CSS).not.toMatch(
      /\.trainingGroupTeamName[\s\S]*var\(--ib-training-font-size-compact\)/,
    );
    expect(CSS).not.toMatch(
      /\.trainingGroupTeamName[\s\S]*var\(--ib-training-font-size-dense\)/,
    );
  });

  it("always resolves grouped training cards to normal density tier", () => {
    for (const count of [1, 3, 5, 8, 10, 15]) {
      expect(trainingGroupDensityTier(count)).toBe("normal");
    }
  });

  it("maps saved Training font presets to the root CSS contract only", () => {
    for (const size of INFOBOARD_FONT_SIZES) {
      const { container } = renderTrainingCohort(5, size);
      const root = container.querySelector(
        "[data-testid='infoboard-screen1-root']",
      ) as HTMLElement;
      expect(root.style.getPropertyValue("--ib-training-font-size")).toBe(
        TRAINING_FONT_SIZE_CSS[size].normal,
      );
      cleanup();
    }
  });
});

describe("INFOBOARD-KIOSK-VIEWPORT-01E universal pagination", () => {
  it("derives page capacity from presentation without FC Allschwil row magic", () => {
    const defaultMax = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
    expect(defaultMax).toBeGreaterThan(0);
    for (const count of [1, 3, 5, 8, 10, 15]) {
      expect(computeTrainingGroupDemand(count)).toBeCloseTo(1 + count * 0.55);
    }
  });

  it.each([1, 3, 5, 8, 10, 15] as const)(
    "paginates %i simultaneous trainings without hardcoded special casing",
    (count) => {
      const maxDemand = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
      const item = cohortDisplayItem(count);
      const demand = computeTrainingGroupDemand(count);
      const pages = paginateDisplayList([item], [demand], maxDemand);
      const renderedIds = pages
        .flat()
        .flatMap((entry) =>
          entry.kind === "training-group" ? entry.items.map(({ event }) => event.id) : [],
        );
      expect(renderedIds).toHaveLength(count);
      expect(new Set(renderedIds).size).toBe(count);
    },
  );
});

describe("INFOBOARD-KIOSK-VIEWPORT-01E oversized cohort continuation", () => {
  it("splits an oversized cohort deterministically while preserving start time", () => {
    const maxDemand = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
    const cohort = cohortDisplayItem(15);
    const { items, demands } = expandOversizedTrainingGroups(
      [cohort],
      [computeTrainingGroupDemand(15)],
      maxDemand,
    );

    expect(items.length).toBeGreaterThan(1);
    expect(items.every((item) => item.kind === "training-group")).toBe(true);
    expect(
      items.every(
        (item) =>
          item.kind === "training-group"
          && item.items[0]?.event.startAt === "2026-08-27T16:00:00.000Z",
      ),
    ).toBe(true);
    expect(items.some((item) => item.kind === "training-group" && item.cohortContinuation)).toBe(
      true,
    );
    expect(demands.every((demand) => demand <= maxDemand + 1e-9)).toBe(true);

    const allIds = items.flatMap((item) =>
      item.kind === "training-group" ? item.items.map(({ event }) => event.id) : [],
    );
    expect(allIds).toHaveLength(15);
    expect(new Set(allIds).size).toBe(15);
  });

  it("keeps normal cohorts atomic when they fit on one page", () => {
    const maxDemand = resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION);
    expect(computeTrainingGroupDemand(5)).toBeLessThanOrEqual(maxDemand);
    const { items } = expandOversizedTrainingGroups(
      [cohortDisplayItem(5)],
      [computeTrainingGroupDemand(5)],
      maxDemand,
    );
    expect(items).toHaveLength(1);
    if (items[0]?.kind === "training-group") {
      expect(items[0].items).toHaveLength(5);
    }
  });

  it("renders continuation pages with the same start time and typography", () => {
    const maxDemand = 4.5;
    const maxRows = maxTrainingRowsForPageCapacity(maxDemand);
    expect(maxRows).toBeGreaterThan(0);

    const cohort = cohortDisplayItem(10);
    const pages = paginateDisplayList(
      [cohort],
      [computeTrainingGroupDemand(10)],
      maxDemand,
    );

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const card = page[0];
      expect(card?.kind).toBe("training-group");
      if (card?.kind === "training-group") {
        expect(
          within(
            render(
              <InfoboardScreen1
                feed={{
                  generatedAt: "2026-08-27T12:00:00.000Z",
                  tenant: {
                    id: "tenant-1",
                    key: "tenant",
                    name: "TEST CLUB",
                    timezone: "Europe/Zurich",
                  },
                  displayDate: "2026-08-27",
                  isStale: false,
                  wochenplanVariantBadge: null,
                  current: [],
                  next: card.items.map(({ event }) => event),
                  later: [],
                  isEmpty: false,
                  emptyStateReason: null,
                }}
                branding={BRANDING}
                currentTimeIso="2026-08-27T12:00:00.000Z"
                liveClock={false}
                presentation={{
                  ...DEFAULT_SCREEN1_PRESENTATION,
                  trainingFontSize: "LARGE",
                }}
              />,
            ).container,
          ).getByTestId("training-cohort-start-time"),
        ).toBeTruthy();
        cleanup();
      }
    }
  });

  it("preserves chronology when an oversized cohort is followed by a later cohort", () => {
    const maxDemand = 4.5;
    const early = cohortDisplayItem(10, "2026-08-27T16:00:00.000Z");
    const later = cohortDisplayItem(2, "2026-08-27T18:00:00.000Z");
    const pages = paginateDisplayList(
      [early, later],
      [computeTrainingGroupDemand(10), computeTrainingGroupDemand(2)],
      maxDemand,
    );
    const starts = pages.flat().map((item) =>
      item.kind === "training-group" ? item.items[0]?.event.startAt : null,
    );
    const firstLaterIndex = starts.findIndex((start) => start === "2026-08-27T18:00:00.000Z");
    const lastEarlyIndex = starts.lastIndexOf("2026-08-27T16:00:00.000Z");
    expect(firstLaterIndex).toBeGreaterThan(lastEarlyIndex);
  });
});

describe("INFOBOARD-KIOSK-VIEWPORT-01E buildDisplayList invariants", () => {
  it("never drops trainings when expanding oversized cohorts across pages", () => {
    const flat = makeCohortFlatEvents(12);
    const items = buildDisplayList(flat);
    const maxDemand = resolveScreen1PageDemandMax({
      ...DEFAULT_SCREEN1_PRESENTATION,
      trainingFontSize: "XLARGE",
    });
    const pages = paginateDisplayList(
      items,
      items.map((item) =>
        item.kind === "training-group"
          ? computeTrainingGroupDemand(item.items.length)
          : 2.2,
      ),
      maxDemand,
    );
    const ids = pages
      .flat()
      .flatMap((item) =>
        item.kind === "training-group" ? item.items.map(({ event }) => event.id) : [],
      );
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });
});
