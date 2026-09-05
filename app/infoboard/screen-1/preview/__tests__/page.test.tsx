/**
 * @vitest-environment jsdom
 */

/**
 * app/infoboard/screen-1/preview/__tests__/page.test.tsx
 *
 * Focused tests for the Screen 1 visual acceptance preview routes.
 *
 * Verifies:
 *   1. Preview routes use deterministic fixture data
 *   2. Preview routes are unavailable in production
 *   3. Preview routes do not use the live Screen 1 API/feed
 *   4. Real InfoboardScreen1 renderer is reused
 *   5. Mixed fixture exercises INFOBOARD-LOGO-02 match presentation
 *   6. Tournament fixture exercises four participant logos
 *   7. Training remains unchanged
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PREVIEW_ANNOUNCEMENT,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_FIXTURE,
  PREVIEW_FIXTURE_TOURNAMENT_4TEAM,
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
  PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import { isScreen1AcceptancePreviewAllowed } from "@/lib/infoboard/screen1-acceptance-preview";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  buildScreen1LivePayload: vi.fn(),
  infoboardScreen1: vi.fn(() => <div data-testid="infoboard-screen1-mock" />),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/publishing/infoboard/screen1-live-service", () => ({
  buildScreen1LivePayload: mocks.buildScreen1LivePayload,
}));

vi.mock("@/components/infoboard/screen1/InfoboardScreen1", () => ({
  InfoboardScreen1: mocks.infoboardScreen1,
}));

vi.mock("@/components/infoboard/screen1/Screen1AcceptancePreviewNav", () => ({
  Screen1AcceptancePreviewNav: () => <nav data-testid="preview-nav" />,
}));

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalVercelTargetEnv = process.env.VERCEL_TARGET_ENV;

function allowPreviewEnv(): void {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL_ENV", "preview");
}

function blockPreviewEnv(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
}

describe("isScreen1AcceptancePreviewAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VERCEL_ENV = originalVercelEnv;
    process.env.VERCEL_TARGET_ENV = originalVercelTargetEnv;
  });

  it("allows local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(isScreen1AcceptancePreviewAllowed()).toBe(true);
  });

  it("allows Vercel preview deployments", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isScreen1AcceptancePreviewAllowed()).toBe(true);
  });

  it("blocks production deployments", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isScreen1AcceptancePreviewAllowed()).toBe(false);
  });

  it("blocks the authenticated Acceptance target even when VERCEL_ENV is preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_TARGET_ENV", "acceptance");

    expect(isScreen1AcceptancePreviewAllowed()).toBe(false);
  });
});

describe("Screen 1 acceptance preview routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowPreviewEnv();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VERCEL_ENV = originalVercelEnv;
    process.env.VERCEL_TARGET_ENV = originalVercelTargetEnv;
  });

  describe("production guard", () => {
    it("mixed preview calls notFound in production", async () => {
      blockPreviewEnv();
      const { default: MixedPreviewPage } = await import("../page");

      expect(() => MixedPreviewPage()).toThrow("NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
      expect(mocks.infoboardScreen1).not.toHaveBeenCalled();
    });

    it("tournament preview calls notFound in production", async () => {
      blockPreviewEnv();
      const { default: TournamentPreviewPage } = await import("../tournament/page");

      expect(() => TournamentPreviewPage()).toThrow("NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
      expect(mocks.infoboardScreen1).not.toHaveBeenCalled();
    });
  });

  describe("mixed preview route", () => {
    it("reuses InfoboardScreen1 with deterministic fixture data", async () => {
      const { default: MixedPreviewPage } = await import("../page");
      render(MixedPreviewPage());

      expect(mocks.buildScreen1LivePayload).not.toHaveBeenCalled();
      expect(mocks.infoboardScreen1).toHaveBeenCalledWith(
        expect.objectContaining({
          feed: PREVIEW_FIXTURE,
          currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
          announcement: PREVIEW_ANNOUNCEMENT,
          eventPresentation: PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
        }),
        undefined,
      );
    });

    it("exercises INFOBOARD-LOGO-02 match presentation from the fixture", () => {
      const currentMatch = PREVIEW_FIXTURE.current[0];
      expect(currentMatch.matchPresentation?.home.clubLogoUrl).toBe(
        "/images/logos/fc-allschwil.png",
      );
      expect(currentMatch.matchPresentation?.away?.clubLogoUrl).toBe(
        "/images/logos/preview/fc-binningen.svg",
      );
      expect(currentMatch.matchPresentation?.home.clubDisplayName).toBe("FC ALLSCHWIL");
      expect(currentMatch.matchPresentation?.home.teamSubDisplayName).toBe("E1");
      expect(currentMatch.allocation.homeDressingRoomLabel).toBe("Kabine E1");
      expect(currentMatch.allocation.awayDressingRoomLabel).toBe("Kabine E2");
    });
  });

  describe("tournament preview route", () => {
    it("reuses InfoboardScreen1 with the four-team tournament fixture", async () => {
      const { default: TournamentPreviewPage } = await import("../tournament/page");
      render(TournamentPreviewPage());

      expect(mocks.buildScreen1LivePayload).not.toHaveBeenCalled();
      expect(mocks.infoboardScreen1).toHaveBeenCalledWith(
        expect.objectContaining({
          feed: PREVIEW_FIXTURE_TOURNAMENT_4TEAM,
          currentTimeIso: PREVIEW_FIXTURE_TOURNAMENT_4TEAM.generatedAt,
          eventPresentation: PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS,
        }),
        undefined,
      );
    });

    it("exercises four participant logos in the tournament fixture", () => {
      const allocations =
        PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS[0]?.participantAllocations ?? [];
      expect(allocations).toHaveLength(4);
      expect(allocations.every((participant) => participant.clubLogoUrl)).toBe(true);
    });
  });

  describe("training invariant", () => {
    it("keeps training rows without match presentation or logos", () => {
      const trainingEvents = [
        ...PREVIEW_FIXTURE.next,
        ...PREVIEW_FIXTURE.later.filter((event) => event.type === "TRAINING"),
      ];

      expect(trainingEvents).toHaveLength(2);
      for (const training of trainingEvents) {
        expect(training.type).toBe("TRAINING");
        expect(training.matchPresentation).toBeNull();
        expect(training.opponentLogoUrl).toBeNull();
      }
    });

    it("renders training cards without team logos in the real component", async () => {
      vi.resetModules();
      vi.doUnmock("@/components/infoboard/screen1/InfoboardScreen1");
      const { InfoboardScreen1 } = await import(
        "@/components/infoboard/screen1/InfoboardScreen1"
      );

      render(
        <InfoboardScreen1
          feed={PREVIEW_FIXTURE}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          announcement={PREVIEW_ANNOUNCEMENT}
          eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
        />,
      );

      const trainingRow = screen
        .getAllByTestId("event-row")
        .find((row) => row.textContent?.includes("Juniorinnen FF-14"));
      expect(trainingRow).toBeTruthy();
      expect(within(trainingRow!).queryByTestId("home-team-logo")).toBeNull();
      expect(within(trainingRow!).queryByTestId("away-team-logo")).toBeNull();
    });
  });
});
