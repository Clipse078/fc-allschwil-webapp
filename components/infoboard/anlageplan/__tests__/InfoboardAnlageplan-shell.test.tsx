/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/anlageplan/__tests__/InfoboardAnlageplan-shell.test.tsx
 *
 * INFOBOARD-FINAL-C — Focused tests for InfoboardAnlageplan shared shell config.
 *
 * Covers:
 *   - Default subtitle shown when no shellConfig provided
 *   - Subtitle enabled/disabled via shellConfig
 *   - Editable subtitle text via shellConfig
 *   - Announcement shown/hidden via shellConfig
 *   - Backward compat: no shellConfig → defaults preserved
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { SharedBoardShellConfig } from "@/lib/infoboard/board-config";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/infoboard/anlageplan/AnlageplanMapScene", () => ({
  AnlageplanMapScene: () => <div data-testid="anlageplan-map-scene" />,
}));

vi.mock("@/components/infoboard/screen1/LiveClockScreen1", () => ({
  LiveClockScreen1: () => <span data-testid="live-clock" />,
}));

vi.mock("@/components/infoboard/screen1/AnnouncementTicker", () => ({
  AnnouncementTicker: ({ text }: { text: string }) => (
    <span data-testid="announcement-ticker">{text}</span>
  ),
}));

vi.mock("@/lib/publishing/infoboard/facility-group", () => ({
  groupFacilityPitches: () => ({ visiblePitches: [], suppressedCodes: new Set() }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PAYLOAD: AnlageplanLivePayload = {
  screen2: {
    feed: {
      generatedAt: "2024-01-01T12:00:00Z",
      displayDate: "2024-01-01",
      isStale: false,
      tenant: {
        id: "t1",
        key: "fc-allschwil",
        name: "FC Allschwil",
        timezone: "Europe/Zurich",
      },
      pitches: [],
      dressingRooms: [],
      unallocated: [],
      facilityName: "Sportanlage im Brüel",
    },
    branding: { clubLogoSrc: null, productLogoSrc: null },
    currentTimeIso: "2024-01-01T12:00:00Z",
    theme: "DARK",
  },
  anlageplanConfig: { version: 1, elements: [] },
  backgroundUrl: null,
  backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
  currentTimeIso: "2024-01-01T12:00:00Z",
};

const DEFAULT_SHELL: SharedBoardShellConfig = {
  headerSubtitleEnabled: true,
  headerSubtitleText: "ANLAGENÜBERSICHT",
  headerShowTime: true,
  headerShowDate: true,
  headerShowWeather: false,
  announcementEnabled: false,
  announcementText: null,
  announcementBgColor: null,
  announcementTextColor: null,
};

const BRANDING = {
  clubName: "FC Allschwil",
  facilityName: "Sportanlage im Brüel",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardAnlageplan — shared shell config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows default subtitle 'ANLAGENÜBERSICHT' when no shellConfig provided", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan payload={BASE_PAYLOAD} branding={BRANDING} />,
    );
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toMatch(/ANLAGENÜBERSICHT/i);
  });

  it("shows subtitle when shellConfig.headerSubtitleEnabled=true", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleEnabled: true, headerSubtitleText: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toBe("SPORTANLAGE IM BRÜEL");
  });

  it("hides subtitle when shellConfig.headerSubtitleEnabled=false", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("shows custom subtitle text from shellConfig", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    const customText = "MEIN CUSTOM UNTERTITEL";
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleEnabled: true, headerSubtitleText: customText }}
      />,
    );
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toBe(customText);
  });

  it("shows announcement bar when shellConfig has announcement enabled", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: "Willkommen auf der Sportanlage",
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.getByTestId("announcement-ticker").textContent).toBe(
      "Willkommen auf der Sportanlage",
    );
  });

  it("hides announcement bar when shellConfig announcement is disabled", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, announcementEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hides announcement bar when announcement text is empty", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, announcementEnabled: true, announcementText: "" }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("different boards have independent subtitles", async () => {
    const { InfoboardAnlageplan } = await import("../InfoboardAnlageplan");
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleText: "SCREEN 2 SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toBe("SCREEN 2 SUBTITLE");
    unmount();

    render(
      <InfoboardAnlageplan
        payload={BASE_PAYLOAD}
        branding={BRANDING}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleText: "SCREEN 3 SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toBe("SCREEN 3 SUBTITLE");
  });
});
