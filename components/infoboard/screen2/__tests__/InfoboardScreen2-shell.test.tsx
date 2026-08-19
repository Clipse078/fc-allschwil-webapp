/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/screen2/__tests__/InfoboardScreen2-shell.test.tsx
 *
 * INFOBOARD-FINAL-C — Focused tests for InfoboardScreen2 shared shell config.
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
import { InfoboardScreen2 } from "../InfoboardScreen2";
import type { InfoboardScreen2Feed } from "@/lib/publishing/event-types";
import type { SharedBoardShellConfig } from "@/lib/infoboard/board-config";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/infoboard/screen1/LiveClockScreen1", () => ({
  LiveClockScreen1: () => <span data-testid="live-clock" />,
}));

vi.mock("@/components/infoboard/screen1/AnnouncementTicker", () => ({
  AnnouncementTicker: ({ text }: { text: string }) => (
    <span data-testid="announcement-ticker">{text}</span>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_FEED: InfoboardScreen2Feed = {
  generatedAt: "2024-01-01T12:00:00Z",
  displayDate: "2024-01-01",
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfoboardScreen2 — shared shell config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows default subtitle 'ANLAGENÜBERSICHT' when no shellConfig provided", () => {
    render(<InfoboardScreen2 feed={BASE_FEED} />);
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toMatch(/ANLAGENÜBERSICHT/i);
  });

  it("shows subtitle when shellConfig.headerSubtitleEnabled=true", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          headerSubtitleEnabled: true,
          headerSubtitleText: "SPORTANLAGE IM BRÜEL",
        }}
      />,
    );
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toBe("SPORTANLAGE IM BRÜEL");
  });

  it("hides subtitle when shellConfig.headerSubtitleEnabled=false", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{ ...DEFAULT_SHELL, headerSubtitleEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("shows custom subtitle text from shellConfig", () => {
    const customText = "MEIN CUSTOM UNTERTITEL";
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          headerSubtitleEnabled: true,
          headerSubtitleText: customText,
        }}
      />,
    );
    const titleEl = screen.getByTestId("board-title-text");
    expect(titleEl.textContent).toBe(customText);
  });

  it("shows announcement bar when shellConfig has announcement enabled", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: "Orientierung Sportanlage im Brüel",
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.getByTestId("announcement-ticker").textContent).toBe(
      "Orientierung Sportanlage im Brüel",
    );
  });

  it("hides announcement bar when shellConfig announcement is disabled", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{ ...DEFAULT_SHELL, announcementEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hides announcement bar when announcement text is null", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: null,
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("hides announcement bar when announcement text is empty string", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: "   ",
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("shows kiosk-shell-footer (not announcement-bar) when announcement disabled", () => {
    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{ ...DEFAULT_SHELL, announcementEnabled: false }}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("different boards have independent announcement text", () => {
    const { unmount } = render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: "Screen 1 announcement",
        }}
      />,
    );
    expect(screen.getByTestId("announcement-ticker").textContent).toBe(
      "Screen 1 announcement",
    );
    unmount();

    render(
      <InfoboardScreen2
        feed={BASE_FEED}
        shellConfig={{
          ...DEFAULT_SHELL,
          announcementEnabled: true,
          announcementText: "Screen 2 announcement",
        }}
      />,
    );
    expect(screen.getByTestId("announcement-ticker").textContent).toBe(
      "Screen 2 announcement",
    );
  });

  it("no shellConfig → subtitle defaults to ANLAGENÜBERSICHT (backward compat)", () => {
    render(<InfoboardScreen2 feed={BASE_FEED} />);
    expect(screen.getByTestId("board-title-text").textContent).toMatch(
      /ANLAGENÜBERSICHT/i,
    );
  });

  it("no shellConfig → no announcement bar (backward compat)", () => {
    render(<InfoboardScreen2 feed={BASE_FEED} />);
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });
});
