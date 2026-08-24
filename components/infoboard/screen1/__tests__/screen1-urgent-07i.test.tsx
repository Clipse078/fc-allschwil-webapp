/**
 * INFOBOARD-SCREEN1-URGENT-07I — responsive one-line Match team names.
 */

/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREEN1_LOGO_PRESENTATION,
  MATCH_LOGO_SIZE_CSS,
} from "@/lib/infoboard/screen1-logo-settings";
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "@/lib/publishing/event-types";
import {
  InfoboardScreen1,
  matchTeamNameSize,
} from "../InfoboardScreen1";

const HOME_NAME = "FC ALLSCHWIL SENIOREN 50+";

function makeFeed(homeName: string): InfoboardScreen1Feed {
  const match: InfoboardScreen1Event = {
    id: "match-responsive-name",
    type: "MATCH",
    displayTitle: `${homeName} – FC BINNINGEN`,
    teamDisplayName: homeName,
    opponentDisplayName: "FC BINNINGEN",
    opponentLogoUrl: "/away.png",
    matchPresentation: {
      home: {
        clubDisplayName: homeName,
        teamSubDisplayName: null,
        clubLogoUrl: "/home.png",
      },
      away: {
        clubDisplayName: "FC BINNINGEN",
        teamSubDisplayName: null,
        clubLogoUrl: "/away.png",
      },
    },
    organizerDisplayName: null,
    competitionLabel: "Meisterschaft",
    startAt: "2026-08-24T18:00:00.000Z",
    endAt: "2026-08-24T19:45:00.000Z",
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket: "current",
    seasonKey: "2026-27",
    teamSlug: null,
    allocation: {
      homeDressingRoomLabel: "Kabine 1",
      awayDressingRoomLabel: "Kabine 2",
      refereeDressingRoomLabel: null,
      pitchLabel: "Stadion",
    },
    participantDisplayNames: null,
  };

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
    current: [match],
    next: [],
    later: [],
    isEmpty: false,
    emptyStateReason: null,
  };
}

describe("responsive one-line Match team names (07I)", () => {
  it("renders FC ALLSCHWIL SENIOREN 50+ as one complete Match label", () => {
    render(<InfoboardScreen1 feed={makeFeed(HOME_NAME)} />);

    const homeRow = screen.getByTestId("match-home-team-row");
    const labels = homeRow.querySelectorAll("[data-match-team-label]");

    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent(HOME_NAME);
    expect(homeRow.querySelector("br")).toBeNull();
  });

  it("does not render a secondary Match team-name line", () => {
    render(<InfoboardScreen1 feed={makeFeed(HOME_NAME)} />);

    const homeRow = screen.getByTestId("match-home-team-row");
    expect(homeRow.querySelector('[class*="matchTeamSubName"]')).toBeNull();
    expect(homeRow.querySelectorAll("[data-match-team-label]")).toHaveLength(1);
  });

  it("assigns responsive tiers only when the Match label needs them", () => {
    expect(matchTeamNameSize("FC ALLSCHWIL")).toBe("normal");
    expect(matchTeamNameSize(HOME_NAME)).toBe("medium");
    expect(matchTeamNameSize("FC ALLSCHWIL SENIOREN 50+/7")).toBe("minimum");

    const { rerender } = render(
      <InfoboardScreen1 feed={makeFeed(HOME_NAME)} />,
    );
    expect(
      screen.getByTestId("match-home-team-row").querySelector("[data-match-team-label]"),
    ).toHaveAttribute("data-match-name-size", "medium");

    rerender(<InfoboardScreen1 feed={makeFeed("FC ALLSCHWIL")} />);
    expect(
      screen.getByTestId("match-home-team-row").querySelector("[data-match-team-label]"),
    ).toHaveAttribute("data-match-name-size", "normal");
  });

  it("supports an XLARGE Match logo with the responsive long-name tier", () => {
    const { container } = render(
      <InfoboardScreen1
        feed={makeFeed(HOME_NAME)}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          matchLogoSize: "XLARGE",
        }}
      />,
    );

    const root = container.querySelector(
      "[data-testid='infoboard-screen1-root']",
    ) as HTMLElement;
    const homeRow = screen.getByTestId("match-home-team-row");

    expect(root.style.getPropertyValue("--ib-match-logo-size")).toBe(
      MATCH_LOGO_SIZE_CSS.XLARGE,
    );
    expect(homeRow.querySelector("img")).toBeInTheDocument();
    expect(homeRow.querySelector("[data-match-team-label]")).toHaveAttribute(
      "data-match-name-size",
      "medium",
    );
  });

  it("reclaims the logo slot when Match logos are off", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed(HOME_NAME)}
        logoPresentation={{
          ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
          matchShowLogos: false,
          matchLogoSize: "XLARGE",
        }}
      />,
    );

    const homeRow = screen.getByTestId("match-home-team-row");
    expect(homeRow.querySelector("img")).toBeNull();
    expect(homeRow.querySelector('[class*="matchClubLogoPlaceholder"]')).toBeNull();
    expect(homeRow.querySelector("[data-match-team-label]")).toHaveTextContent(
      HOME_NAME,
    );
  });
});
