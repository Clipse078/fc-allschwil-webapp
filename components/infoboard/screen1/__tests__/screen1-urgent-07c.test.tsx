/**
 * components/infoboard/screen1/__tests__/screen1-urgent-07c.test.tsx
 *
 * INFOBOARD-SCREEN1-URGENT-07C — capacity admission, single-line match names,
 * logo presentation settings.
 */

/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InfoboardScreen1,
  computeMatchDemand,
  type DisplayItem,
} from "../InfoboardScreen1";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import { admitDisplayItemsByCapacity } from "@/lib/publishing/infoboard/screen1-capacity-admission";
import { CARD_DEMAND_PAGE_MAX } from "../InfoboardScreen1";
import {
  DEFAULT_SCREEN1_LOGO_PRESENTATION,
  MATCH_LOGO_SIZE_CSS,
  TOURNAMENT_LOGO_SIZE_CSS,
} from "@/lib/infoboard/screen1-logo-settings";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import type { InboardRow } from "@/lib/infoboard/types";

const BASE_FEED: InfoboardScreen1Feed = {
  generatedAt: "2026-08-24T16:00:00.000Z",
  tenant: {
    id: "tenant-1",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-08-24",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
  emptyStateReason: "NO_EVENTS_TODAY",
};

function makeMatchEvent(
  id: string,
  temporal: "current" | "next" | "later",
  startAt: string,
) {
  return {
    id,
    type: "MATCH" as const,
    displayTitle: "Spiel",
    teamDisplayName: "FC Allschwil",
    opponentDisplayName: "FC Amicitia Riehen",
    organizerDisplayName: null,
    competitionLabel: "Meisterschaft",
    startAt,
    endAt: null,
    meetingTime: null,
    status: "SCHEDULED" as const,
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: temporal,
    allocation: {
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: "Kabine 2",
      refereeDressingRoomLabel: null,
      pitchLabel: "Platz 1",
    },
    seasonKey: "2025-26",
    teamSlug: null,
    matchPresentation: {
      home: {
        clubDisplayName: "FC Allschwil Senioren 50+",
        teamSubDisplayName: null,
        clubLogoUrl: "/logo-home.png",
      },
      away: {
        clubDisplayName: "FC Amicitia Riehen",
        teamSubDisplayName: null,
        clubLogoUrl: "/logo-away.png",
      },
    },
    participantDisplayNames: null,
  };
}

describe("Match single-line team name (07C)", () => {
  it("renders configured own-team name once without sub-line", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [makeMatchEvent("m1", "current", "2026-08-24T18:00:00.000Z")],
    };

    render(<InfoboardScreen1 feed={feed} />);

    const homeRow = screen.getByTestId("match-home-team-row");
    expect(homeRow.textContent).toContain("FC Allschwil Senioren 50+");
    expect(homeRow.querySelectorAll('[class*="matchTeamSubName"]').length).toBe(0);
  });

  it("opponent uses one primary name line", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [makeMatchEvent("m1", "current", "2026-08-24T18:00:00.000Z")],
    };

    render(<InfoboardScreen1 feed={feed} />);

    const awayRow = screen.getByTestId("match-away-team-row");
    expect(awayRow.textContent).toContain("FC Amicitia Riehen");
    expect(awayRow.querySelectorAll("span").length).toBe(1);
  });
});

describe("Logo presentation settings (07C)", () => {
  it("renders match logos when enabled", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [makeMatchEvent("m1", "current", "2026-08-24T18:00:00.000Z")],
    };

    render(<InfoboardScreen1 feed={feed} />);

    expect(screen.getByTestId("home-team-logo")).toBeInTheDocument();
    expect(screen.getByTestId("away-team-logo")).toBeInTheDocument();
  });

  it("hides match logos when disabled", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [makeMatchEvent("m1", "current", "2026-08-24T18:00:00.000Z")],
    };

    render(
      <InfoboardScreen1
        feed={feed}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          matchShowLogos: false,
        }}
      />,
    );

    expect(screen.queryByTestId("home-team-logo")).toBeNull();
    expect(screen.queryByTestId("home-team-logo-placeholder")).toBeNull();
    expect(screen.queryByTestId("away-team-logo")).toBeNull();
  });

  it("applies match logo size CSS custom property", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [makeMatchEvent("m1", "current", "2026-08-24T18:00:00.000Z")],
    };

    const { container } = render(
      <InfoboardScreen1
        feed={feed}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          matchLogoSize: "LARGE",
        }}
      />,
    );

    const root = container.querySelector("[data-testid='infoboard-screen1-root']") as HTMLElement;
    expect(root?.style.getPropertyValue("--ib-match-logo-size")).toBe(
      MATCH_LOGO_SIZE_CSS.LARGE,
    );
  });

  it("tournament logo settings are independent from match", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [
        {
          ...makeMatchEvent("t1", "current", "2026-08-24T18:00:00.000Z"),
          type: "TOURNAMENT",
          matchPresentation: null,
          displayTitle: "Mini-Turnier",
        },
      ],
    };

    const { container } = render(
      <InfoboardScreen1
        feed={feed}
        eventPresentation={[
          {
            eventId: "t1",
            participantAllocations: [
              {
                id: "p1",
                teamDisplayName: "Team A",
                dressingRoomLabel: "1",
                clubLogoUrl: "/a.png",
              },
            ],
          },
        ]}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          matchShowLogos: false,
          matchLogoSize: "SMALL",
          tournamentShowLogos: true,
          tournamentLogoSize: "XLARGE",
        }}
      />,
    );

    const root = container.querySelector("[data-testid='infoboard-screen1-root']") as HTMLElement;
    expect(root?.style.getPropertyValue("--ib-tournament-logo-size")).toBe(
      TOURNAMENT_LOGO_SIZE_CSS.XLARGE,
    );
    expect(screen.getByTestId("tournament-participant-logo-p1")).toBeInTheDocument();
  });

  it("hides tournament logos when disabled", () => {
    const feed: InfoboardScreen1Feed = {
      ...BASE_FEED,
      isEmpty: false,
      emptyStateReason: null,
      current: [
        {
          ...makeMatchEvent("t1", "current", "2026-08-24T18:00:00.000Z"),
          type: "TOURNAMENT",
          matchPresentation: null,
          displayTitle: "Mini-Turnier",
        },
      ],
    };

    render(
      <InfoboardScreen1
        feed={feed}
        eventPresentation={[
          {
            eventId: "t1",
            participantAllocations: [
              {
                id: "p1",
                teamDisplayName: "Team A",
                dressingRoomLabel: "1",
                clubLogoUrl: "/a.png",
              },
            ],
          },
        ]}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          tournamentShowLogos: false,
        }}
      />,
    );

    expect(screen.queryByTestId("tournament-participant-logo-p1")).toBeNull();
    expect(
      screen.queryByTestId("tournament-participant-logo-p1-placeholder"),
    ).toBeNull();
  });
});

describe("Capacity admission integration (07C)", () => {
  it("match demand no longer includes sub-team line weight", () => {
    const event = makeMatchEvent("m1", "later", "2026-08-24T20:15:00.000Z");
    expect(computeMatchDemand(event)).toBe(2.2);
  });

  it("excludes later match when display capacity is full", () => {
    const items: DisplayItem[] = [
      {
        kind: "training-group",
        temporal: "current",
        items: [
          {
            event: {
              ...makeMatchEvent("t1", "current", "2026-08-24T17:00:00.000Z"),
              type: "TRAINING",
              matchPresentation: null,
            },
            temporal: "current",
          },
          {
            event: {
              ...makeMatchEvent("t2", "current", "2026-08-24T17:00:00.000Z"),
              type: "TRAINING",
              matchPresentation: null,
            },
            temporal: "current",
          },
          {
            event: {
              ...makeMatchEvent("t3", "current", "2026-08-24T17:00:00.000Z"),
              type: "TRAINING",
              matchPresentation: null,
            },
            temporal: "current",
          },
          {
            event: {
              ...makeMatchEvent("t4", "current", "2026-08-24T17:00:00.000Z"),
              type: "TRAINING",
              matchPresentation: null,
            },
            temporal: "current",
          },
        ],
      },
      {
        kind: "event",
        item: {
          event: makeMatchEvent("n1", "next", "2026-08-24T19:00:00.000Z"),
          temporal: "next",
        },
      },
      {
        kind: "event",
        item: {
          event: makeMatchEvent("m2015", "later", "2026-08-24T20:15:00.000Z"),
          temporal: "later",
        },
      },
    ];

    const demands = [6.0, 6.0, 2.2];
    const admitted = admitDisplayItemsByCapacity(
      items,
      demands,
      (item) =>
        item.kind === "training-group" ? item.temporal : item.item.temporal,
      CARD_DEMAND_PAGE_MAX,
    );

    const ids = admitted.map((item) =>
      item.kind === "training-group"
        ? "training-group"
        : item.item.event.id,
    );
    expect(ids).not.toContain("m2015");
  });
});

describe("Board config persistence defaults (07C)", () => {
  it("defaults match and tournament logo settings to enabled MEDIUM", () => {
    const board = {
      id: "b1",
      tenantId: "t1",
      name: "Test",
      slug: "test",
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
      createdAt: new Date(),
      updatedAt: new Date(),
    } as InboardRow;

    const config = buildBoardConfig(board);
    expect(config.presentation).toEqual({
      trainingShowLogos: true,
      trainingLogoSize: "MEDIUM",
      matchShowLogos: true,
      matchLogoSize: "MEDIUM",
      tournamentShowLogos: true,
      tournamentLogoSize: "MEDIUM",
      trainingFontSize: "LARGE",
      matchFontSize: "MEDIUM",
      tournamentFontSize: "LARGE",
    });
  });
});
