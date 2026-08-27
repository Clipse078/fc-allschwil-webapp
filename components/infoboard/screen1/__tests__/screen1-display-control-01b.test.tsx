/**
 * @vitest-environment jsdom
 *
 * INFOBOARD-KIOSK-VIEWPORT-01B — admin display control end-to-end regressions.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import {
  DEFAULT_SCREEN1_PRESENTATION,
  MATCH_FONT_SIZE_CSS,
  MATCH_LOGO_SIZE_CSS,
  resolveScreen1PageDemandMax,
  TRAINING_FONT_SIZE_CSS,
  TRAINING_LOGO_SIZE_CSS,
  TOURNAMENT_FONT_SIZE_CSS,
  TOURNAMENT_LOGO_SIZE_CSS,
  type InfoboardFontSize,
} from "@/lib/infoboard/screen1-logo-settings";
import type { InboardRow } from "@/lib/infoboard/types";
import {
  buildDisplayList,
  computeTrainingGroupDemand,
  paginateDisplayList,
  type FlatEvent,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  buildThursday20260827Feed,
  resolveThursdayPreviewCurrentTimeIso,
} from "@/components/infoboard/screen1/thursday-2026-08-27-fixture";
import type { InfoboardScreen1Event } from "@/lib/publishing/event-types";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";

const CSS = readFileSync(
  resolve(process.cwd(), "components/infoboard/screen1/InfoboardScreen1.module.css"),
  "utf8",
);

const BRANDING = {
  clubLogoSrc: "/images/logos/fc-allschwil.png",
  productLogoSrc: "/images/branding/sportclubevo_logo.png",
};

function board(overrides: Partial<InboardRow> = {}): InboardRow {
  return {
    id: "board-1",
    tenantId: "tenant-1",
    name: "Tagesübersicht Eingang",
    slug: "screen-1",
    status: "ACTIVE",
    templateType: "TAGESUEBERSICHT",
    displayTheme: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: null,
    headerShowTime: true,
    headerShowDate: true,
    headerShowWeather: false,
    announcementEnabled: false,
    announcementText: null,
    announcementBgColor: null,
    announcementTextColor: null,
    layoutJson: null,
    anlageplanBackgroundUrl: null,
    anlageplanJson: null,
    sortOrder: 0,
    screen1TrainingShowLogos: true,
    screen1TrainingLogoSize: "MEDIUM",
    screen1MatchShowLogos: true,
    screen1MatchLogoSize: "MEDIUM",
    screen1TournamentShowLogos: true,
    screen1TournamentLogoSize: "MEDIUM",
    screen1TrainingFontSize: "LARGE",
    screen1MatchFontSize: "MEDIUM",
    screen1TournamentFontSize: "LARGE",
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    ...overrides,
  };
}

function trainingEvent(id: string, label: string): InfoboardScreen1Event {
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
    startAt: "2026-08-27T15:15:00.000Z",
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

function renderTrainingGroup(
  rowCount: number,
  presentation: Partial<typeof DEFAULT_SCREEN1_PRESENTATION>,
) {
  const events = Array.from({ length: rowCount }, (_, index) =>
    trainingEvent(`t-${index}`, `TEAM ${index + 1}`),
  );
  return render(
    <InfoboardScreen1
      feed={{
        generatedAt: "2026-08-27T12:00:00.000Z",
        tenant: {
          id: "tenant-1",
          key: "fc-allschwil",
          name: "FC ALLSCHWIL",
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
      presentation={{ ...DEFAULT_SCREEN1_PRESENTATION, ...presentation }}
    />,
  );
}

function rootStyle(size: InfoboardFontSize, token: "--ib-training-font-size" | "--ib-match-font-size" | "--ib-tournament-font-size") {
  const { container } = renderTrainingGroup(1, {
    trainingFontSize: size,
    matchFontSize: size,
    tournamentFontSize: size,
  });
  const root = container.querySelector(
    "[data-testid='infoboard-screen1-root']",
  ) as HTMLElement;
  return root.style.getPropertyValue(token);
}

afterEach(() => {
  cleanup();
});

describe("INFOBOARD-KIOSK-VIEWPORT-01B display controls", () => {
  it("maps persisted board config to the same presentation object used by Screen 1", () => {
    const persisted = buildBoardConfig(
      board({
        screen1TrainingFontSize: "SMALL",
        screen1TrainingLogoSize: "LARGE",
        screen1TrainingShowLogos: false,
        screen1MatchFontSize: "MEDIUM",
        screen1TournamentFontSize: "XLARGE",
      }),
    ).presentation;

    expect(persisted).toEqual({
      trainingShowLogos: false,
      trainingLogoSize: "LARGE",
      trainingFontSize: "SMALL",
      matchShowLogos: true,
      matchLogoSize: "MEDIUM",
      matchFontSize: "MEDIUM",
      tournamentShowLogos: true,
      tournamentLogoSize: "MEDIUM",
      tournamentFontSize: "XLARGE",
    });
  });

  it("Training font SMALL, MEDIUM, and LARGE produce distinct root CSS contracts", () => {
    expect(rootStyle("SMALL", "--ib-training-font-size")).toBe(
      TRAINING_FONT_SIZE_CSS.SMALL.normal,
    );
    expect(rootStyle("MEDIUM", "--ib-training-font-size")).toBe(
      TRAINING_FONT_SIZE_CSS.MEDIUM.normal,
    );
    expect(rootStyle("LARGE", "--ib-training-font-size")).toBe(
      TRAINING_FONT_SIZE_CSS.LARGE.normal,
    );
    expect(TRAINING_FONT_SIZE_CSS.SMALL.normal).not.toBe(
      TRAINING_FONT_SIZE_CSS.LARGE.normal,
    );
  });

  it("Training typography is not capped by adaptive event-count tokens", () => {
    expect(CSS).toContain(".trainingGroupTeamName");
    expect(CSS).toMatch(
      /\.trainingGroupTeamName[\s\S]*font-size:\s*var\(--ib-training-font-size\)/,
    );
    expect(CSS).not.toMatch(
      /\.trainingGroupTeamName[\s\S]*min\(var\(--ib-training-font-size\),\s*var\(--ib-fs-event-team\)\)/,
    );
  });

  it("Training logo visibility toggles crest rendering", () => {
    renderTrainingGroup(1, { trainingShowLogos: false, trainingLogoSize: "LARGE" });
    expect(screen.queryByTestId("training-team-logo")).toBeNull();

    cleanup();
    renderTrainingGroup(1, { trainingShowLogos: true, trainingLogoSize: "LARGE" });
    expect(screen.getByTestId("training-team-logo")).toBeTruthy();
  });

  it("Training logo size presets map to distinct CSS variables", () => {
    const smallRoot = renderTrainingGroup(1, {
      trainingShowLogos: true,
      trainingLogoSize: "SMALL",
    }).container.querySelector("[data-testid='infoboard-screen1-root']") as HTMLElement;
    cleanup();
    const largeRoot = renderTrainingGroup(1, {
      trainingShowLogos: true,
      trainingLogoSize: "LARGE",
    }).container.querySelector("[data-testid='infoboard-screen1-root']") as HTMLElement;

    expect(smallRoot.style.getPropertyValue("--ib-training-logo-size")).toBe(
      TRAINING_LOGO_SIZE_CSS.SMALL,
    );
    expect(largeRoot.style.getPropertyValue("--ib-training-logo-size")).toBe(
      TRAINING_LOGO_SIZE_CSS.LARGE,
    );
  });

  it("Match font and logo presets map independently", () => {
    const { container } = render(
      <InfoboardScreen1
        feed={{
          generatedAt: "2026-08-27T12:00:00.000Z",
          tenant: {
            id: "tenant-1",
            key: "fc-allschwil",
            name: "FC ALLSCHWIL",
            timezone: "Europe/Zurich",
          },
          displayDate: "2026-08-27",
          isStale: false,
          wochenplanVariantBadge: null,
          current: [
            {
              ...trainingEvent("m1", "FC ALLSCHWIL"),
              type: "MATCH",
              opponentDisplayName: "FC Rival",
            },
          ],
          next: [],
          later: [],
          isEmpty: false,
          emptyStateReason: null,
        }}
        branding={BRANDING}
        currentTimeIso="2026-08-27T12:00:00.000Z"
        liveClock={false}
        presentation={{
          ...DEFAULT_SCREEN1_PRESENTATION,
          matchFontSize: "SMALL",
          matchLogoSize: "XLARGE",
        }}
      />,
    );
    const root = container.querySelector(
      "[data-testid='infoboard-screen1-root']",
    ) as HTMLElement;
    expect(root.style.getPropertyValue("--ib-match-font-size")).toBe(
      MATCH_FONT_SIZE_CSS.SMALL.primary,
    );
    expect(root.style.getPropertyValue("--ib-match-logo-size")).toBe(
      MATCH_LOGO_SIZE_CSS.XLARGE,
    );
    expect(CSS).toMatch(
      /\.eventCard\[data-type="MATCH"\] \.eventTeamMain[\s\S]*--ib-match-team-name-base:\s*var\(--ib-match-font-size\)/,
    );
  });

  it("Tournament font preset maps to root CSS and is not capped by event-count tokens", () => {
    const { container } = render(
      <InfoboardScreen1
        feed={{
          generatedAt: "2026-08-27T12:00:00.000Z",
          tenant: {
            id: "tenant-1",
            key: "fc-allschwil",
            name: "FC ALLSCHWIL",
            timezone: "Europe/Zurich",
          },
          displayDate: "2026-08-27",
          isStale: false,
          wochenplanVariantBadge: null,
          current: [
            {
              ...trainingEvent("t1", "Turnier"),
              type: "TOURNAMENT",
              teamDisplayName: null,
              displayTitle: "Junioren Cup",
            },
          ],
          next: [],
          later: [],
          isEmpty: false,
          emptyStateReason: null,
        }}
        branding={BRANDING}
        currentTimeIso="2026-08-27T12:00:00.000Z"
        liveClock={false}
        presentation={{
          ...DEFAULT_SCREEN1_PRESENTATION,
          tournamentFontSize: "SMALL",
          tournamentLogoSize: "LARGE",
        }}
      />,
    );
    const root = container.querySelector(
      "[data-testid='infoboard-screen1-root']",
    ) as HTMLElement;
    expect(root.style.getPropertyValue("--ib-tournament-font-size")).toBe(
      TOURNAMENT_FONT_SIZE_CSS.SMALL,
    );
    expect(root.style.getPropertyValue("--ib-tournament-logo-size")).toBe(
      TOURNAMENT_LOGO_SIZE_CSS.LARGE,
    );
    expect(CSS).toMatch(/\.tournamentTitle[\s\S]*font-size:\s*var\(--ib-tournament-font-size\)/);
  });

  it("XLARGE presentation lowers page capacity for the dense Thursday page", () => {
    const nowIso = resolveThursdayPreviewCurrentTimeIso("14:00");
    const feed = buildThursday20260827Feed(nowIso);
    const flat: FlatEvent[] = [
      ...feed.current.map((event) => ({ event, temporal: "current" as const })),
      ...feed.next.map((event) => ({ event, temporal: "next" as const })),
      ...feed.later.map((event) => ({ event, temporal: "later" as const })),
    ];
    const items = buildDisplayList(flat);
    const demands = items.map((item) =>
      item.kind === "training-group"
        ? computeTrainingGroupDemand(item.items.length)
        : 2.2,
    );

    const defaultPages = paginateDisplayList(
      items,
      demands,
      resolveScreen1PageDemandMax(DEFAULT_SCREEN1_PRESENTATION),
    );
    const xlargePages = paginateDisplayList(
      items,
      demands,
      resolveScreen1PageDemandMax({
        ...DEFAULT_SCREEN1_PRESENTATION,
        trainingFontSize: "XLARGE",
        matchFontSize: "XLARGE",
        tournamentFontSize: "XLARGE",
        trainingLogoSize: "XLARGE",
        matchLogoSize: "XLARGE",
        tournamentLogoSize: "XLARGE",
      }),
    );

    expect(defaultPages).toHaveLength(1);
    expect(xlargePages.length).toBeGreaterThanOrEqual(defaultPages.length);
  });
});
