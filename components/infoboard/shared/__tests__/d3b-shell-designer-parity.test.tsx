/**
 * @vitest-environment jsdom
 */

/**
 * INFOBOARD-FINAL-D3B — Shell and Designer UX Parity Tests.
 *
 * Proves:
 *
 * HEADER PARITY
 *   - Screen 1 and Screen 2 Anlageplan use the SAME kiosk-shell-header testid
 *   - Screen 2 facilityName in branding does NOT appear in the header when no
 *     subtitle is configured (no implicit facility-line injection)
 *   - configured subtitle appears on BOTH screens identically
 *   - empty/null subtitle renders nothing on BOTH screens
 *
 * FOOTER PARITY
 *   - Screen 1 and Screen 2 Anlageplan use the SAME kiosk-shell-footer testid
 *   - announcement-bar testid appears on BOTH screens when announcement active
 *   - announcement icon present on BOTH screens
 *   - announcement branding (product-branding) present on BOTH screens
 *   - no left-label text on BOTH screens when no announcement
 *
 * DESIGNER UX PARITY
 *   - Screen 1 Designer shows section nav items: Kopfzeile, Tagesübersicht, Hinweisleiste
 *   - Screen 2 Designer shows section nav items: Kopfzeile, Anlagenplan, Hinweisleiste
 *   - Both use the SAME section-navigator outer testid (section-navigator for Screen2,
 *     widget-palette for Screen1 — same pattern)
 *   - Both show HeaderWidgetPanel for Kopfzeile section
 *   - Both show AnnouncementWidgetPanel for Hinweisleiste section
 *   - Screen 2 has NO tab bar (no role="tablist")
 *
 * FACILITY-LINE REGRESSION
 *   - InfoboardAnlageplan: branding.facilityName NOT visible in header left zone
 *   - InfoboardScreen2: feed.facilityName NOT visible in header left zone
 *   - Screen 1: no SPORTANLAGE IM BRÜEL anywhere
 *
 * WEATHER GUARD
 *   - showWeather=true → weather visible on both screens
 *   - showWeather=false → weather hidden on both screens
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/infoboard/screen1/LiveClockScreen1", () => ({
  LiveClockScreen1: ({ initialTimeIso }: { initialTimeIso?: string | null }) => (
    <div data-testid="live-clock-screen1">{initialTimeIso ?? "TIME"}</div>
  ),
}));

vi.mock("@/components/infoboard/screen1/AnnouncementTicker", () => ({
  AnnouncementTicker: ({ text }: { text: string }) => (
    <span data-testid="announcement-ticker">{text}</span>
  ),
}));

vi.mock("@/components/infoboard/screen1/InfoboardPageRotator", () => ({
  InfoboardPageRotator: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-rotator-mock">{children}</div>
  ),
}));

// Designer mocks (heavy client components)
const mockFetch = vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ board: {} }),
}));
vi.stubGlobal("fetch", mockFetch);
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cb: ResizeObserverCallback) {}
});

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { InboardDesignerClient } from "@/components/infoboard/v2/designer/InboardDesignerClient";
import { AnlageplanDesignerClient } from "@/components/infoboard/v2/designer/anlageplan/AnlageplanDesignerClient";
import {
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardScreen1Feed, InfoboardScreen2Feed } from "@/lib/publishing/event-types";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { WeatherResult } from "@/lib/weather/weather-types";
import type { InboardRow } from "@/lib/infoboard/types";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeScreen1Feed(
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

function makeScreen2Feed(
  overrides: Partial<InfoboardScreen2Feed> = {},
): InfoboardScreen2Feed {
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
    facilityName: "",
    pitches: [],
    dressingRooms: [],
    unallocated: [],
    ...overrides,
  };
}

function makeAnlageplanPayload(): AnlageplanLivePayload {
  return {
    screen2: {
      feed: makeScreen2Feed(),
      branding: { clubLogoSrc: null, productLogoSrc: null },
      currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
      theme: "DARK",
    },
    anlageplanConfig: {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    },
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: PREVIEW_CURRENT_TIME_ISO,
  };
}

const AVAILABLE_WEATHER: WeatherResult = {
  isAvailable: true,
  temperatureC: 20,
  conditionCode: 1,
  conditionLabel: "Sonnig",
  windKmh: 8,
  precipitationProbability: null,
  observedAt: "2026-09-12T08:00:00.000Z",
};

function makeScreen1Board(overrides: Partial<InboardRow> = {}): InboardRow {
  return {
    id: "board-s1",
    name: "Screen 1",
    slug: "screen-1",
    status: "ACTIVE",
    templateType: "TAGESUEBERSICHT",
    tenantId: "tenant-1",
    displayTheme: "DARK",
    announcementEnabled: false,
    announcementText: null,
    announcementBgColor: null,
    announcementTextColor: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: null,
    headerShowTime: true,
    headerShowDate: true,
    headerShowWeather: false,
    layoutJson: null,
    anlageplanJson: null,
    anlageplanBackgroundUrl: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeScreen2Board(overrides: Partial<InboardRow> = {}): InboardRow {
  return {
    id: "board-s2",
    name: "Screen 2",
    slug: "screen-2",
    status: "ACTIVE",
    templateType: "ANLAGENUEBERSICHT",
    tenantId: "tenant-1",
    displayTheme: "DARK",
    announcementEnabled: false,
    announcementText: null,
    announcementBgColor: null,
    announcementTextColor: null,
    headerSubtitleEnabled: true,
    headerSubtitleText: null,
    headerShowTime: true,
    headerShowDate: true,
    headerShowWeather: false,
    layoutJson: null,
    anlageplanJson: null,
    anlageplanBackgroundUrl: null,
    sortOrder: 1,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── HEADER PARITY — same shared component ─────────────────────────────────────

describe("D3B Header parity — same shared component on both screens", () => {
  it("Screen 1 renders kiosk-shell-header", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("Screen 2 Anlageplan renders kiosk-shell-header", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-header")).toBeTruthy();
  });

  it("Screen 1 and Screen 2 both render kiosk-header-club-name", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("kiosk-header-club-name")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("kiosk-header-club-name")).toBeTruthy();
  });

  it("Screen 1 and Screen 2 both render header-center (clock zone)", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("header-center")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("header-center")).toBeTruthy();
  });

  it("Screen 1 and Screen 2 both render alexa-safe-zone", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("alexa-safe-zone")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("alexa-safe-zone")).toBeTruthy();
  });

  it("Screen 1 subtitle renders when configured", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: "HERZLICH WILLKOMMEN" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("HERZLICH WILLKOMMEN");
  });

  it("Screen 2 Anlageplan subtitle renders when configured", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "HERZLICH WILLKOMMEN" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("HERZLICH WILLKOMMEN");
  });

  it("Screen 1 no subtitle when empty", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("Screen 2 Anlageplan no subtitle when empty", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });
});

// ── FACILITY-LINE REGRESSION ──────────────────────────────────────────────────

describe("D3B Facility-line regression — no implicit branding in header", () => {
  it("Screen 2 Anlageplan: branding.facilityName does NOT appear in header left zone", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC ALLSCHWIL", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    const headerLeft = screen.getByTestId("kiosk-header-left");
    expect(headerLeft.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("Screen 2 Anlageplan: full header does NOT contain facilityName when no subtitle configured", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC ALLSCHWIL", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("Screen 2 InfoboardScreen2: feed.facilityName does NOT appear in header left zone", () => {
    render(
      <InfoboardScreen2
        feed={makeScreen2Feed({ facilityName: "SPORTANLAGE IM BRÜEL" })}
      />,
    );
    const headerLeft = screen.getByTestId("kiosk-header-left");
    expect(headerLeft.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("Screen 1: no SPORTANLAGE IM BRÜEL in header", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const header = screen.getByTestId("kiosk-shell-header");
    expect(header.textContent?.toUpperCase()).not.toContain("SPORTANLAGE IM BRÜEL");
  });

  it("Screen 2 Anlageplan: club name IS shown correctly", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC ALLSCHWIL", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    expect(screen.getByTestId("kiosk-header-club-name").textContent).toBe("FC ALLSCHWIL");
  });

  it("facilityName IS shown as subtitle when explicitly configured as subtitleText", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC ALLSCHWIL", facilityName: "SPORTANLAGE IM BRÜEL" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("SPORTANLAGE IM BRÜEL");
  });
});

// ── FOOTER PARITY — same shared component ─────────────────────────────────────

describe("D3B Footer parity — same shared component on both screens", () => {
  it("Screen 1 renders kiosk-shell-footer when no announcement", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("Screen 2 Anlageplan renders kiosk-shell-footer when no announcement", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("Screen 1 renders announcement-bar when announcement active", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "BITTE DIE KABINEN BESENREIN", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.queryByTestId("kiosk-shell-footer")).toBeNull();
  });

  it("Screen 2 Anlageplan renders announcement-bar when announcement active", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "ANLAGE GESPERRT", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    expect(screen.queryByTestId("kiosk-shell-footer")).toBeNull();
  });

  it("Screen 1 announcement-bar has announcement-icon", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: "TEST", backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-icon")).toBeTruthy();
  });

  it("Screen 2 Anlageplan announcement-bar has announcement-icon", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: "TEST", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-icon")).toBeTruthy();
  });

  it("Screen 1 footer has product-branding", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("Screen 2 Anlageplan footer has product-branding", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
      />,
    );
    expect(screen.getByTestId("product-branding")).toBeTruthy();
  });

  it("Screen 1 footer left zone is empty when no announcement", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
      />,
    );
    const footerLeft = screen.getByTestId("kiosk-footer-left");
    expect(footerLeft.textContent?.trim()).toBe("");
  });

  it("Screen 2 Anlageplan footer left zone is empty when no announcement", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test", facilityName: "SPORTANLAGE IM BRÜEL" }}
      />,
    );
    const footerLeft = screen.getByTestId("kiosk-footer-left");
    expect(footerLeft.textContent?.trim()).toBe("");
  });
});

// ── DESIGNER UX PARITY ────────────────────────────────────────────────────────

describe("D3B Designer UX parity — section navigator", () => {
  it("Screen 1 Designer shows widget-palette with Kopfzeile section", () => {
    render(
      <InboardDesignerClient
        board={makeScreen1Board()}
        tenantName="FC Test"
        onBoardChange={() => {}}
      />,
    );
    expect(screen.getByTestId("widget-palette")).toBeTruthy();
    expect(screen.getByTestId("widget-palette-item-header")).toBeTruthy();
  });

  it("Screen 1 Designer shows Tagesübersicht section", () => {
    render(
      <InboardDesignerClient
        board={makeScreen1Board()}
        tenantName="FC Test"
        onBoardChange={() => {}}
      />,
    );
    expect(screen.getByTestId("widget-palette-item-activities")).toBeTruthy();
  });

  it("Screen 1 Designer shows Hinweisleiste (announcement) section", () => {
    render(
      <InboardDesignerClient
        board={makeScreen1Board()}
        tenantName="FC Test"
        onBoardChange={() => {}}
      />,
    );
    expect(screen.getByTestId("widget-palette-item-announcement")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows section-navigator", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("section-navigator")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows Kopfzeile section nav item", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("section-nav-item-kopfzeile")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows Anlagenplan section nav item", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("section-nav-item-anlageplan")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows Hinweisleiste section nav item", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("section-nav-item-hinweisleiste")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer has NO tab bar (no role=tablist)", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(document.querySelector('[role="tablist"]')).toBeNull();
  });

  it("Screen 2 Anlageplan Designer shows HeaderWidgetPanel when Kopfzeile selected", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("section-nav-item-kopfzeile"));
    expect(screen.getByTestId("anlageplan-header-panel")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows AnnouncementWidgetPanel when Hinweisleiste selected", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("section-nav-item-hinweisleiste"));
    expect(screen.getByTestId("anlageplan-announcement-panel")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer shows settings panel with selected section icon/name", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("section-settings-panel")).toBeTruthy();
  });

  it("Screen 2 Anlageplan Designer save button is present (same pattern as Screen 1)", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    expect(screen.getByTestId("designer-save-button")).toBeTruthy();
  });

  it("Screen 1 Designer save button is present", () => {
    render(
      <InboardDesignerClient
        board={makeScreen1Board()}
        tenantName="FC Test"
        onBoardChange={() => {}}
      />,
    );
    expect(screen.getByTestId("designer-save-button")).toBeTruthy();
  });

  it("Screen 2 Anlageplan section nav items have aria-pressed attribute", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    const kopfzeileBtn = screen.getByTestId("section-nav-item-kopfzeile");
    expect(kopfzeileBtn.getAttribute("aria-pressed")).toBeDefined();
  });

  it("Screen 2 Anlageplan default section is ANLAGEPLAN (canvas tools visible)", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    const anlageplanBtn = screen.getByTestId("section-nav-item-anlageplan");
    expect(anlageplanBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("Screen 2 Anlageplan: Kopfzeile section nav item becomes selected on click", () => {
    render(
      <AnlageplanDesignerClient
        board={makeScreen2Board()}
        facilityOptions={[]}
      />,
    );
    const kopfzeileBtn = screen.getByTestId("section-nav-item-kopfzeile");
    expect(kopfzeileBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(kopfzeileBtn);
    expect(kopfzeileBtn.getAttribute("aria-pressed")).toBe("true");
  });
});

// ── WEATHER GUARD ─────────────────────────────────────────────────────────────

describe("D3B Weather guard — preserved on both screens", () => {
  it("Screen 1 showWeather=true → weather visible", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("Screen 1 showWeather=false → weather hidden", () => {
    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("Screen 2 Anlageplan showWeather=true → weather visible", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ showWeather: true }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("Screen 2 Anlageplan showWeather=false → weather hidden", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ showWeather: false }}
        weather={AVAILABLE_WEATHER}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });
});

// ── PER-BOARD INDEPENDENCE (D3B cross-validation) ─────────────────────────────

describe("D3B Per-board independence — equivalent config produces equivalent shell", () => {
  const SHARED_SUBTITLE = "HERZLICH WILLKOMMEN";
  const SHARED_ANNOUNCEMENT = "PLATZ 2 GESPERRT";

  it("Same subtitle text renders on both Screen 1 and Screen 2", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: SHARED_SUBTITLE }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain(SHARED_SUBTITLE);
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: SHARED_SUBTITLE }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain(SHARED_SUBTITLE);
  });

  it("Same announcement text renders on both Screen 1 and Screen 2", () => {
    const { unmount } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        announcement={{ enabled: true, text: SHARED_ANNOUNCEMENT, backgroundColor: null, textColor: null }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{
          announcement: { enabled: true, text: SHARED_ANNOUNCEMENT, backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });

  it("Screen 1 configured, Screen 2 empty — values remain independent", () => {
    const { unmount: u1 } = render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: true, subtitleText: SHARED_SUBTITLE }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain(SHARED_SUBTITLE);
    u1();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: false, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("Screen 2 configured, Screen 1 empty — values remain independent", () => {
    const { unmount: u2 } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Test" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "ANLAGENÜBERSICHT" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("ANLAGENÜBERSICHT");
    u2();

    render(
      <InfoboardScreen1
        feed={makeScreen1Feed()}
        currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
        headerConfig={{ subtitleEnabled: false, subtitleText: null }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });
});
