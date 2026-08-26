/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-ROLLING-01O — Training team-name typography is independent of
 * cohort row count and its normal/compact/dense geometry tier.
 */

import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "../InfoboardScreen1";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  TRAINING_FONT_SIZE_CSS,
} from "@/lib/infoboard/screen1-logo-settings";
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "@/lib/publishing/event-types";

const CSS = readFileSync(
  resolve(
    process.cwd(),
    "components/infoboard/screen1/InfoboardScreen1.module.css",
  ),
  "utf8",
);

function cssBlock(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `Missing CSS selector ${selector}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

function trainingEvent(index: number): InfoboardScreen1Event {
  return {
    id: `training-${index}`,
    type: "TRAINING",
    displayTitle: `FC Allschwil Team ${index + 1}`,
    teamDisplayName: `FC Allschwil Team ${index + 1}`,
    opponentDisplayName: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt: "2026-08-26T18:15:00.000Z",
    endAt: "2026-08-26T19:45:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    allocation: {
      homeDressingRoomLabel: `Kabine ${index + 1}`,
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
      pitchLabel: `KR ${index + 1}`,
    },
    seasonKey: "2026-27",
    teamSlug: null,
    matchPresentation: null,
    participantDisplayNames: null,
  };
}

function feed(rowCount: number): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-08-26T18:15:00.000Z",
    tenant: {
      id: "tenant-fca",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-08-26",
    isStale: false,
    wochenplanVariantBadge: null,
    current: Array.from({ length: rowCount }, (_, index) => trainingEvent(index)),
    next: [],
    later: [],
    isEmpty: false,
    emptyStateReason: null,
  };
}

afterEach(cleanup);

describe("INFOBOARD-ROLLING-01O — unified Training typography", () => {
  it("uses one authoritative team-name rule with the accepted 17:15 size", () => {
    const expected = TRAINING_FONT_SIZE_CSS[
      DEFAULT_SCREEN1_PRESENTATION.trainingFontSize
    ];
    const teamNameRule = cssBlock(".trainingGroupTeamName {");

    expect(expected).toBe("clamp(1.15rem, 1.55vw, 2.2rem)");
    expect(teamNameRule).toContain(
      "font-size: var(--ib-training-team-font-size)",
    );
    expect(teamNameRule).not.toContain("--ib-fs-event-team");

    // At the authoritative 1920px viewport, 1.55vw resolves to 29.76px.
    expect(1920 * 0.0155).toBeCloseTo(29.76);
  });

  it.each([
    [1, "normal"],
    [2, "normal"],
    [4, "compact"],
    [5, "compact"],
    [6, "dense"],
  ] as const)(
    "keeps the %i-row %s card on the same team-name token",
    (rowCount, density) => {
      const { container } = render(
        <InfoboardScreen1
          feed={feed(rowCount)}
          currentTimeIso="2026-08-26T18:15:00.000Z"
        />,
      );
      const root = container.querySelector<HTMLElement>(
        "[data-testid='infoboard-screen1-root']",
      );
      const card = container.querySelector<HTMLElement>(
        "[data-testid='event-row']",
      );
      const names = container.querySelectorAll(
        "[data-testid='training-group-row']",
      );

      expect(card).toHaveAttribute("data-group-density", density);
      expect(names).toHaveLength(rowCount);
      expect(root?.style.getPropertyValue("--ib-training-team-font-size")).toBe(
        TRAINING_FONT_SIZE_CSS.LARGE,
      );
      expect(root?.style.getPropertyValue("--ib-training-font-size-compact")).toBe(
        "",
      );
      expect(root?.style.getPropertyValue("--ib-training-font-size-dense")).toBe(
        "",
      );
    },
  );

  it("allows density tiers to change geometry but not team-name font-size", () => {
    for (const density of ["compact", "dense"]) {
      const selector =
        `.eventCard[data-type="TRAINING"][data-group-density="${density}"] `
        + ".trainingGroupTeamName";
      expect(cssBlock(selector)).not.toContain("font-size:");
    }

    expect(
      cssBlock(
        '.eventCard[data-type="TRAINING"][data-group-density="compact"] '
        + ".trainingRowMatrix",
      ),
    ).toContain("--ib-training-row-height");
    expect(
      cssBlock(
        '.eventCard[data-type="TRAINING"][data-group-density="dense"] '
        + ".trainingRowMatrix",
      ),
    ).toContain("--ib-training-row-height");
  });
});
