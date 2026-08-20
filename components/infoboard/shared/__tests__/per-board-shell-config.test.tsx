/**
 * @vitest-environment jsdom
 */

/**
 * INFOBOARD-FINAL-D — Focused tests for per-board shell configuration.
 *
 * Verifies:
 *   PER-BOARD ISOLATION
 *   - Board A and Board B have different subtitle values; resolving A does not
 *     contaminate B and vice versa.
 *   - Board A and Board B have different time/date/weather toggles that are
 *     resolved independently.
 *   - Board A and Board B have different announcement values / colors.
 *
 *   SCREEN 1 SHELL
 *   - weather toggle follows headerShowWeather (ON → visible, OFF → hidden)
 *   - subtitle toggle follows headerSubtitleEnabled
 *   - announcement renders when enabled on Screen 1
 *   - announcement hidden when disabled on Screen 1
 *
 *   SCREEN 2 / ANLAGEPLAN SHELL
 *   - shell settings propagate to KioskShellHeader
 *   - weather follows headerShowWeather toggle
 *   - announcement renders when enabled on InfoboardAnlageplan
 *   - announcement hidden when disabled on InfoboardAnlageplan
 *   - Anlageplan map canvas is always present (Anlageplan content unchanged)
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import type { WeatherResult } from "@/lib/weather/weather-types";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { InfoboardAnlageplanShellConfig } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeFeed(
  overrides: Partial<InfoboardScreen1Feed> = {},
): InfoboardScreen1Feed {
  return {
    generatedAt: "2026-09-12T08:30:00.000Z",
    tenant: {
      id: "tenant-test",
      key: "test-club",
      name: "FC Test",
      timezone: "Europe/Zurich",
    },
    displayDate: "2026-09-12",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    emptyStateReason: "NO_EVENTS_TODAY",
    ...overrides,
  };
}

const AVAILABLE_WEATHER: WeatherResult = {
  isAvailable: true,
  temperatureC: 21,
  conditionCode: 1,
  conditionLabel: "Sonnig",
  windKmh: 10,
  precipitationProbability: null,
  observedAt: "2026-09-12T08:30:00.000Z",
};

function makeAnlageplanPayload(): AnlageplanLivePayload {
  return {
    screen2: {
      feed: {
        generatedAt: "2026-09-12T08:30:00.000Z",
        tenant: {
          id: "tenant-test",
          key: "test-club",
          name: "FC Test",
          timezone: "Europe/Zurich",
        },
        displayDate: "2026-09-12",
        isStale: false,
        facilityName: "Sportanlage",
        pitches: [],
        dressingRooms: [],
        unallocated: [],
      },
      branding: { clubLogoSrc: null, productLogoSrc: null },
      currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
      theme: "DARK",
    },
    anlageplanConfig: { version: 1, elements: [], backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 } },
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
  };
}

// ── PER-BOARD ISOLATION — Screen 1 ────────────────────────────────────────────

describe("Per-board shell config — Screen 1 isolation", () => {
  it("board A subtitle is independent of board B subtitle", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "BOARD A SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("BOARD A SUBTITLE");
    unmount();

    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "BOARD B SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("BOARD B SUBTITLE");
    expect(screen.queryByText("BOARD A SUBTITLE")).toBeNull();
  });

  it("board A subtitle does not contaminate board B when A disabled and B enabled", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: false, subtitleText: "BOARD A SUBTITLE" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
    unmount();

    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "BOARD B SUBTITLE" }}
      />,
    );
    expect(screen.getByTestId("board-title")).toBeTruthy();
    expect(screen.getByTestId("board-title-text").textContent).toContain("BOARD B SUBTITLE");
  });

  it("board A weather=ON is isolated from board B weather=OFF", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    unmount();

    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("board A announcement active does not appear on board B (disabled)", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "BOARD A ANNOUNCEMENT", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    unmount();

    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: false, text: null, backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("board A announcement colors are isolated from board B colors", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "BOARD A", backgroundColor: "#ff0000", textColor: "#ffffff" }}
      />,
    );
    const barA = screen.getByTestId("announcement-bar");
    expect(barA.style.backgroundColor).toBe("rgb(255, 0, 0)");
    unmount();

    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "BOARD B", backgroundColor: "#0000ff", textColor: "#ffff00" }}
      />,
    );
    const barB = screen.getByTestId("announcement-bar");
    expect(barB.style.backgroundColor).toBe("rgb(0, 0, 255)");
  });
});

// ── SCREEN 1 WEATHER TOGGLE ────────────────────────────────────────────────────

describe("Screen 1 — weather toggle respects headerShowWeather", () => {
  it("weather ON → header-weather element is visible", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("weather OFF → header-weather element is absent", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("weather absent from headerConfig defaults to OFF (false)", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("weather ON with unavailable weather data → no weather element", () => {
    const unavailableWeather: WeatherResult = { isAvailable: false };
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: true }}
        weather={unavailableWeather}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });
});

// ── SCREEN 1 SUBTITLE TOGGLE ──────────────────────────────────────────────────

describe("Screen 1 — subtitle toggle", () => {
  it("subtitleEnabled=true with custom text renders board-title", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "MEIN INFOBOARD" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("MEIN INFOBOARD");
  });

  it("subtitleEnabled=false → board-title absent", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: false, subtitleText: "HIDDEN" }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("subtitleEnabled=true with null text uses default", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("HEUTE AUF DER SPORTANLAGE");
  });
});

// ── SCREEN 1 ANNOUNCEMENT ─────────────────────────────────────────────────────

describe("Screen 1 — announcement bar", () => {
  it("renders announcement-bar when enabled with text", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "Platz 2 gesperrt", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });

  it("does not render announcement-bar when disabled", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: false, text: "Platz 2 gesperrt", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
  });

  it("applies custom announcement background color", () => {
    render(
      <InfoboardScreen1
        feed={makeFeed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "Hinweis", backgroundColor: "#e87722", textColor: "#ffffff" }}
      />,
    );
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.style.backgroundColor).toBe("rgb(232, 119, 34)");
  });
});

// ── SCREEN 2 / ANLAGEPLAN SHELL ───────────────────────────────────────────────

describe("Screen 2 (InfoboardAnlageplan) — shell config", () => {
  it("renders anlageplan-map-canvas (Anlageplan content present)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("anlageplan-map-canvas")).toBeTruthy();
  });

  it("shellConfig.showWeather=true → header-weather visible", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: true }}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("shellConfig.showWeather=false → header-weather absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: false }}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("default shellConfig → weather absent (default is false)", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("shellConfig.subtitleText renders in board-title", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "MEINE ANLAGE" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("MEINE ANLAGE");
  });

  it("shellConfig.subtitleEnabled=false → board-title absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("announcement enabled → announcement-bar rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "Anlage gesperrt", backgroundColor: "#1e3a5f", textColor: "#ffffff" },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });

  it("announcement disabled → announcement-bar absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: false, text: "Anlage gesperrt", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("board A and board B announcement colors are isolated on Screen 2", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "Board A", backgroundColor: "#ff0000", textColor: "#ffffff" },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar").style.backgroundColor).toBe("rgb(255, 0, 0)");
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "Board B", backgroundColor: "#003366", textColor: "#ffffff" },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar").style.backgroundColor).toBe("rgb(0, 51, 102)");
  });
});
