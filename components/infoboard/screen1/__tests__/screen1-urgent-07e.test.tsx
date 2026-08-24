/**
 * INFOBOARD-SCREEN1-URGENT-07E — Training logo presentation controls.
 */

/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import {
  DEFAULT_SCREEN1_LOGO_PRESENTATION,
  INFOBOARD_LOGO_SIZES,
  TRAINING_LOGO_SIZE_CSS,
  resolveInfoboardLogoSize,
  type InfoboardLogoSize,
} from "@/lib/infoboard/screen1-logo-settings";
import type { InboardRow } from "@/lib/infoboard/types";
import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "@/lib/publishing/event-types";
import { InfoboardScreen1 } from "../InfoboardScreen1";

const TRAINING_EVENT: InfoboardScreen1Event = {
  id: "training-1",
  type: "TRAINING",
  displayTitle: "Junioren E1",
  teamDisplayName: "FC Allschwil Junioren E1",
  opponentDisplayName: null,
  organizerDisplayName: null,
  competitionLabel: null,
  startAt: "2026-08-24T18:00:00.000Z",
  endAt: "2026-08-24T19:30:00.000Z",
  meetingTime: null,
  status: "SCHEDULED",
  resultLabel: null,
  intermediateResultLabel: null,
  temporalBucket: "current",
  allocation: {
    homeDressingRoomLabel: "Kabine 1",
    awayDressingRoomLabel: null,
    refereeDressingRoomLabel: null,
    pitchLabel: "Platz 1",
  },
  seasonKey: "2026-27",
  teamSlug: null,
  matchPresentation: null,
  participantDisplayNames: null,
};

const TRAINING_FEED: InfoboardScreen1Feed = {
  generatedAt: "2026-08-24T18:00:00.000Z",
  tenant: {
    id: "tenant-1",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-08-24",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [TRAINING_EVENT],
  next: [],
  later: [],
  isEmpty: false,
  emptyStateReason: null,
};

function renderTraining(
  overrides: Partial<typeof DEFAULT_SCREEN1_LOGO_PRESENTATION> = {},
) {
  return render(
    <InfoboardScreen1
      feed={TRAINING_FEED}
      branding={{ clubLogoSrc: "/training-logo.png" }}
      logoPresentation={{
        ...DEFAULT_SCREEN1_LOGO_PRESENTATION,
        ...overrides,
      }}
    />,
  );
}

describe("Training logo rendering (07E)", () => {
  it("renders the existing Training club logo when enabled", () => {
    renderTraining({ trainingShowLogos: true });

    expect(screen.getByTestId("training-team-logo")).toHaveAttribute(
      "src",
      "/training-logo.png",
    );
  });

  it("does not render a Training logo when disabled", () => {
    renderTraining({ trainingShowLogos: false });

    expect(screen.queryByTestId("training-team-logo")).toBeNull();
  });

  it.each(INFOBOARD_LOGO_SIZES)(
    "resolves and reaches Screen 1 presentation for %s",
    (size: InfoboardLogoSize) => {
      expect(resolveInfoboardLogoSize(size)).toBe(size);
      const { container } = renderTraining({ trainingLogoSize: size });
      const root = container.querySelector(
        "[data-testid='infoboard-screen1-root']",
      ) as HTMLElement;

      expect(root.style.getPropertyValue("--ib-training-logo-size")).toBe(
        TRAINING_LOGO_SIZE_CSS[size],
      );
    },
  );
});

describe("Per-board logo setting independence (07E)", () => {
  it("keeps Training, Match, and Tournament values independent", () => {
    const board = {
      id: "board-1",
      tenantId: "tenant-1",
      name: "Eingang",
      slug: "eingang",
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
      screen1TrainingShowLogos: false,
      screen1TrainingLogoSize: "SMALL",
      screen1MatchShowLogos: true,
      screen1MatchLogoSize: "LARGE",
      screen1TournamentShowLogos: true,
      screen1TournamentLogoSize: "XLARGE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as InboardRow;

    expect(buildBoardConfig(board).logoPresentation).toEqual({
      trainingShowLogos: false,
      trainingLogoSize: "SMALL",
      matchShowLogos: true,
      matchLogoSize: "LARGE",
      tournamentShowLogos: true,
      tournamentLogoSize: "XLARGE",
    });
  });
});
