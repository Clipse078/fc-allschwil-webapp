/**
 * INFOBOARD-SCREEN1-URGENT-07K — per-card Screen 1 font controls.
 */

/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  INFOBOARD_FONT_SIZES,
  MATCH_FONT_SIZE_CSS,
  MATCH_LOGO_SIZE_CSS,
  TOURNAMENT_FONT_SIZE_CSS,
  TRAINING_FONT_SIZE_CSS,
  type InfoboardFontSize,
  type Screen1PresentationConfig,
} from "@/lib/infoboard/screen1-logo-settings";
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "@/lib/publishing/event-types";
import { InfoboardScreen1 } from "../InfoboardScreen1";

const CSS = readFileSync(
  resolve(
    process.cwd(),
    "components/infoboard/screen1/InfoboardScreen1.module.css",
  ),
  "utf8",
);

function event(
  id: string,
  type: "TRAINING" | "MATCH" | "TOURNAMENT",
  overrides: Partial<InfoboardScreen1Event> = {},
): InfoboardScreen1Event {
  return {
    id,
    type,
    displayTitle:
      type === "TOURNAMENT" ? "Junioren Sommerturnier" : "FC Allschwil",
    teamDisplayName: type === "TOURNAMENT" ? null : "FC Allschwil",
    opponentDisplayName: type === "MATCH" ? "FC Amicitia Riehen" : null,
    organizerDisplayName: null,
    competitionLabel: type === "MATCH" ? "Meisterschaft" : null,
    startAt: "2026-08-24T18:00:00.000Z",
    endAt: "2026-08-24T19:30:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    allocation: {
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: type === "MATCH" ? "Kabine 2" : null,
      refereeDressingRoomLabel: null,
      pitchLabel: "Stadion",
    },
    seasonKey: "2026-27",
    teamSlug: null,
    matchPresentation: null,
    participantDisplayNames: null,
    ...overrides,
  };
}

function feed(events: InfoboardScreen1Event[]): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-08-24T17:30:00.000Z",
    tenant: {
      id: "tenant-1",
      key: "fc-allschwil",
      name: "FC Allschwil",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-08-24",
    isStale: false,
    wochenplanVariantBadge: null,
    current: events,
    next: [],
    later: [],
    isEmpty: false,
    emptyStateReason: null,
  };
}

function rootFor(
  events: InfoboardScreen1Event[],
  overrides: Partial<Screen1PresentationConfig>,
): HTMLElement {
  const { container } = render(
    <InfoboardScreen1
      feed={feed(events)}
      branding={{ clubLogoSrc: "/club.png" }}
      presentation={{ ...DEFAULT_SCREEN1_PRESENTATION, ...overrides }}
    />,
  );
  return container.querySelector(
    "[data-testid='infoboard-screen1-root']",
  ) as HTMLElement;
}

describe("Training font presets", () => {
  it.each(INFOBOARD_FONT_SIZES)(
    "maps %s to its normal, compact, and dense CSS values",
    (size: InfoboardFontSize) => {
      const root = rootFor([event("training", "TRAINING")], {
        trainingFontSize: size,
      });
      expect(root.style.getPropertyValue("--ib-training-font-size")).toBe(
        TRAINING_FONT_SIZE_CSS[size].normal,
      );
      expect(
        root.style.getPropertyValue("--ib-training-font-size-compact"),
      ).toBe(TRAINING_FONT_SIZE_CSS[size].compact);
      expect(root.style.getPropertyValue("--ib-training-font-size-dense")).toBe(
        TRAINING_FONT_SIZE_CSS[size].dense,
      );
    },
  );

  it("keeps six-row density authoritative over XLARGE", () => {
    const trainings = Array.from({ length: 6 }, (_, index) =>
      event(`training-${index}`, "TRAINING", {
        teamDisplayName: `FC Allschwil Team ${index + 1}`,
      }),
    );
    const root = rootFor(trainings, { trainingFontSize: "XLARGE" });
    expect(screen.getByTestId("training-group").closest("li")).toHaveAttribute(
      "data-group-density",
      "dense",
    );
    expect(root.style.getPropertyValue("--ib-training-font-size-dense")).toBe(
      TRAINING_FONT_SIZE_CSS.XLARGE.dense,
    );
    expect(TRAINING_FONT_SIZE_CSS.XLARGE.dense).toBe(
      TRAINING_FONT_SIZE_CSS.LARGE.dense,
    );
  });
});

describe("Match font presets and responsive ceiling", () => {
  const longName = "FC ALLSCHWIL SENIOREN 50+";
  const longMatch = event("match", "MATCH", {
    teamDisplayName: longName,
    displayTitle: `${longName} – FC AMICITIA RIEHEN`,
    matchPresentation: {
      home: {
        clubDisplayName: longName,
        teamSubDisplayName: null,
        clubLogoUrl: "/home.png",
      },
      away: {
        clubDisplayName: "FC AMICITIA RIEHEN",
        teamSubDisplayName: null,
        clubLogoUrl: "/away.png",
      },
    },
  });

  it.each(INFOBOARD_FONT_SIZES)(
    "maps %s independently",
    (size: InfoboardFontSize) => {
      const root = rootFor([longMatch], { matchFontSize: size });
      expect(root.style.getPropertyValue("--ib-match-font-size")).toBe(
        MATCH_FONT_SIZE_CSS[size].primary,
      );
      expect(
        root.style.getPropertyValue("--ib-match-opponent-font-size"),
      ).toBe(MATCH_FONT_SIZE_CSS[size].opponent);
    },
  );

  it("keeps the acceptance name complete on one line with no secondary name", () => {
    rootFor([longMatch], { matchFontSize: "MEDIUM" });
    const row = screen.getByTestId("match-home-team-row");
    expect(row.querySelectorAll("[data-match-team-label]")).toHaveLength(1);
    expect(row.querySelector("[data-match-team-label]")).toHaveTextContent(
      longName,
    );
    expect(row.querySelector("br")).toBeNull();
    expect(row.querySelector('[class*="matchTeamSubName"]')).toBeNull();
  });

  it("applies the selected preset before the long-name cap", () => {
    rootFor([longMatch], { matchFontSize: "SMALL" });
    expect(
      screen.getByTestId("match-home-team-row").querySelector(
        "[data-match-team-label]",
      ),
    ).toHaveAttribute("data-match-name-size", "medium");
    expect(CSS).toContain("--ib-match-team-name-base: min(");
    expect(CSS).toContain("text-overflow: clip");
  });

  it.each(["SMALL", "MEDIUM"] as const)(
    "supports XLARGE logos with %s text",
    (matchFontSize) => {
      const root = rootFor([longMatch], {
        matchFontSize,
        matchLogoSize: "XLARGE",
      });
      expect(root.style.getPropertyValue("--ib-match-logo-size")).toBe(
        MATCH_LOGO_SIZE_CSS.XLARGE,
      );
      expect(screen.getByTestId("home-team-logo")).toBeInTheDocument();
    },
  );
});

describe("Tournament font presets and card-type isolation", () => {
  it.each(INFOBOARD_FONT_SIZES)(
    "maps %s independently",
    (size: InfoboardFontSize) => {
      const root = rootFor([event("tournament", "TOURNAMENT")], {
        tournamentFontSize: size,
      });
      expect(root.style.getPropertyValue("--ib-tournament-font-size")).toBe(
        TOURNAMENT_FONT_SIZE_CSS[size],
      );
    },
  );

  it("does not let one card-type setting alter the other two", () => {
    const root = rootFor(
      [
        event("training", "TRAINING"),
        event("match", "MATCH"),
        event("tournament", "TOURNAMENT"),
      ],
      { trainingFontSize: "SMALL" },
    );
    expect(root.style.getPropertyValue("--ib-training-font-size")).toBe(
      TRAINING_FONT_SIZE_CSS.SMALL.normal,
    );
    expect(root.style.getPropertyValue("--ib-match-font-size")).toBe(
      MATCH_FONT_SIZE_CSS.MEDIUM.primary,
    );
    expect(root.style.getPropertyValue("--ib-tournament-font-size")).toBe(
      TOURNAMENT_FONT_SIZE_CSS.LARGE,
    );
  });
});
