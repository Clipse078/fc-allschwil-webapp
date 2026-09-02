/**
 * @vitest-environment jsdom
 */

/**
 * components/infoboard/anlageplan/__tests__/anlageplan-d2.test.tsx
 *
 * INFOBOARD-FINAL-D2 — Focused regression suite for Screen 2 framing and
 * shell management.
 *
 * A. Screen 2 shell config — shell fields respected in live InfoboardAnlageplan
 * B. Per-board isolation — Board A and Board B do not cross-contaminate
 * C. Designer reachability — AnlageplanDesignerClient exposes Header + Announcement UI
 * D. Persistence — save payload includes all shell fields
 * E. Framing — live canvas is 16:9 constrained (same as designer)
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

// ── Browser API stubs (jsdom environment) ─────────────────────────────────────

// ResizeObserver is used by AnlageplanDesignerClient for canvas sizing.
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cb: ResizeObserverCallback) {}
});

vi.stubGlobal("crypto", { randomUUID: () => "d2-test-uuid" });

import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import { AnlageplanDesignerClient } from "@/components/infoboard/v2/designer/anlageplan/AnlageplanDesignerClient";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { WeatherResult } from "@/lib/weather/weather-types";
import type { InboardRow } from "@/lib/infoboard/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AVAILABLE_WEATHER: WeatherResult = {
  isAvailable: true,
  temperatureC: 18,
  conditionCode: 1,
  conditionLabel: "Sonnig",
  windKmh: 12,
  precipitationProbability: null,
  observedAt: "2026-09-01T10:00:00.000Z",
};

function makeAnlageplanPayload(
  overrides: Partial<AnlageplanLivePayload> = {},
): AnlageplanLivePayload {
  return {
    screen2: {
      feed: {
        generatedAt: "2026-09-01T10:00:00.000Z",
        tenant: {
          id: "tenant-fca",
          key: "fc-allschwil",
          name: "FC Allschwil",
          timezone: "Europe/Zurich",
        },
        displayDate: "2026-09-01",
        isStale: false,
        facilityName: "Sportanlage",
        pitches: [],
        dressingRooms: [],
        unallocated: [],
      },
      branding: { clubLogoSrc: null, productLogoSrc: null },
      currentTimeIso: "2026-09-01T10:00:00.000Z",
      theme: "DARK",
    },
    anlageplanConfig: {
      version: 1,
      elements: [],
      backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    },
    backgroundUrl: null,
    backgroundTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    currentTimeIso: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeBoard(overrides: Partial<InboardRow> = {}): InboardRow {
  return {
    id: "board-d2-test",
    tenantId: "tenant-fca",
    name: "screen-2",
    slug: "screen-2",
    status: "ACTIVE",
    templateType: "ANLAGENUEBERSICHT",
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
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ── A. Screen 2 shell config ──────────────────────────────────────────────────

describe("A. Screen 2 shell config — InfoboardAnlageplan", () => {
  it("subtitleEnabled=true renders custom subtitleText", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "ANLAGENÜBERSICHT D2" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("ANLAGENÜBERSICHT D2");
  });

  it("subtitleEnabled=false → board-title element absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{ subtitleEnabled: false }}
      />,
    );
    expect(screen.queryByTestId("board-title")).toBeNull();
  });

  it("showTime=false → time clock absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{ showTime: false }}
      />,
    );
    // The time element should not appear when showTime is false
    expect(screen.queryByTestId("kiosk-clock")).toBeNull();
  });

  it("showWeather=true with weather data → header-weather visible", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: true }}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
  });

  it("showWeather=false → header-weather absent even with weather data", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: false }}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("announcement enabled with text → announcement-bar rendered", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: {
            enabled: true,
            text: "Anlage heute bis 18:00 geöffnet",
            backgroundColor: "#1e3a5f",
            textColor: "#ffffff",
          },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
  });

  it("announcement disabled → announcement-bar absent", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: false, text: "hidden", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByTestId("announcement-bar")).toBeNull();
    expect(screen.getByTestId("kiosk-shell-footer")).toBeTruthy();
  });

  it("announcement backgroundColor is applied", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: true, text: "Farbe", backgroundColor: "#e87722", textColor: "#ffffff" },
        }}
      />,
    );
    const bar = screen.getByTestId("announcement-bar");
    expect(bar.style.backgroundColor).toBe("rgb(232, 119, 34)");
  });
});

// ── B. Per-board isolation ────────────────────────────────────────────────────

describe("B. Per-board isolation — Screen 2", () => {
  it("board A subtitle does not appear on board B", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "SUBTITLE BOARD A" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("SUBTITLE BOARD A");
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{ subtitleEnabled: true, subtitleText: "SUBTITLE BOARD B" }}
      />,
    );
    expect(screen.getByTestId("board-title-text").textContent).toContain("SUBTITLE BOARD B");
    expect(screen.queryByText("SUBTITLE BOARD A")).toBeNull();
  });

  it("board A weather=ON does not affect board B weather=OFF", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: true }}
      />,
    );
    expect(screen.getByTestId("header-weather")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        weather={AVAILABLE_WEATHER}
        shellConfig={{ showWeather: false }}
      />,
    );
    expect(screen.queryByTestId("header-weather")).toBeNull();
  });

  it("board A announcement text does not appear on board B", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: true, text: "ANNOUNCEMENT A", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar")).toBeTruthy();
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: true, text: "ANNOUNCEMENT B", backgroundColor: null, textColor: null },
        }}
      />,
    );
    expect(screen.queryByText("ANNOUNCEMENT A")).toBeNull();
  });

  it("board A announcement colors do not contaminate board B", () => {
    const { unmount } = render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: true, text: "A", backgroundColor: "#ff0000", textColor: "#ffffff" },
        }}
      />,
    );
    expect(screen.getByTestId("announcement-bar").style.backgroundColor).toBe("rgb(255, 0, 0)");
    unmount();

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
        shellConfig={{
          announcement: { enabled: true, text: "B", backgroundColor: "#003366", textColor: "#ffffff" },
        }}
      />,
    );
    const barB = screen.getByTestId("announcement-bar");
    expect(barB.style.backgroundColor).toBe("rgb(0, 51, 102)");
  });
});

// ── C. Designer reachability ──────────────────────────────────────────────────

describe("C. Designer reachability — AnlageplanDesignerClient", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("renders the left-panel section navigator with Kopfzeile, Anlagenplan, Hinweisleiste sections", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    // Section navigator replaces old right-panel tab bar (D3B UX parity)
    expect(screen.getByTestId("section-navigator")).toBeTruthy();
    // Kopfzeile section
    expect(screen.getByTestId("section-nav-item-kopfzeile")).toBeTruthy();
    // Hinweisleiste section
    expect(screen.getByTestId("section-nav-item-hinweisleiste")).toBeTruthy();
    // Anlagenplan section
    expect(screen.getByTestId("section-nav-item-anlageplan")).toBeTruthy();
    // No old tab bar
    expect(document.querySelector("[role='tablist']")).toBeNull();
  });

  it("clicking Kopfzeile section nav item reveals header panel", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    fireEvent.click(screen.getByTestId("section-nav-item-kopfzeile"));
    expect(screen.getByTestId("anlageplan-header-panel")).toBeTruthy();
  });

  it("clicking Hinweisleiste section nav item reveals announcement panel", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    fireEvent.click(screen.getByTestId("section-nav-item-hinweisleiste"));
    expect(screen.getByTestId("anlageplan-announcement-panel")).toBeTruthy();
  });

  it("header panel and announcement panel are not both visible at once", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    // Click Kopfzeile
    fireEvent.click(screen.getByTestId("section-nav-item-kopfzeile"));
    expect(screen.getByTestId("anlageplan-header-panel")).toBeTruthy();
    expect(screen.queryByTestId("anlageplan-announcement-panel")).toBeNull();

    // Click Hinweisleiste
    fireEvent.click(screen.getByTestId("section-nav-item-hinweisleiste"));
    expect(screen.getByTestId("anlageplan-announcement-panel")).toBeTruthy();
    expect(screen.queryByTestId("anlageplan-header-panel")).toBeNull();
  });

  it("save button is reachable from the canvas toolbar", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    const saveButtons = screen.getAllByRole("button", { name: /speichern/i });
    expect(saveButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ── D. Persistence — save payload contains shell fields ───────────────────────

describe("D. Persistence — save payload includes shell fields", () => {
  it("saves header settings along with anlageplanJson", async () => {
    const capturedBodies: unknown[] = [];
    const mockFetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBodies.push(JSON.parse(opts.body as string));
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            board: makeBoard({
              headerSubtitleEnabled: true,
              headerSubtitleText: "MEINE ANLAGE",
              headerShowTime: true,
              headerShowDate: false,
              headerShowWeather: true,
            }),
          }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AnlageplanDesignerClient
        board={makeBoard({
          headerSubtitleEnabled: true,
          headerSubtitleText: "MEINE ANLAGE",
          headerShowTime: true,
          headerShowDate: false,
          headerShowWeather: true,
        })}
        tenantName="FC Allschwil"
      />,
    );

    const saveButton = screen.getAllByRole("button", { name: /speichern/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body).toMatchObject({
      headerSubtitleEnabled: true,
      headerSubtitleText: "MEINE ANLAGE",
      headerShowTime: true,
      headerShowDate: false,
      headerShowWeather: true,
    });
    expect(body).toHaveProperty("anlageplanJson");
  });

  it("saves announcement settings along with anlageplanJson", async () => {
    const capturedBodies: unknown[] = [];
    const mockFetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedBodies.push(JSON.parse(opts.body as string));
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            board: makeBoard({
              announcementEnabled: true,
              announcementText: "Platz 3 gesperrt",
              announcementBgColor: "#e87722",
              announcementTextColor: "#ffffff",
            }),
          }),
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <AnlageplanDesignerClient
        board={makeBoard({
          announcementEnabled: true,
          announcementText: "Platz 3 gesperrt",
          announcementBgColor: "#e87722",
          announcementTextColor: "#ffffff",
        })}
        tenantName="FC Allschwil"
      />,
    );

    const saveButton = screen.getAllByRole("button", { name: /speichern/i })[0];
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body).toMatchObject({
      announcementEnabled: true,
      announcementText: "Platz 3 gesperrt",
      announcementBgColor: "#e87722",
      announcementTextColor: "#ffffff",
    });
    expect(body).toHaveProperty("anlageplanJson");
  });

  it("board A and board B shell fields are sent separately (no cross-contamination)", async () => {
    const bodiesA: unknown[] = [];
    const fetchA = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      bodiesA.push(JSON.parse(opts.body as string));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ board: makeBoard({ id: "board-a" }) }),
      });
    });
    vi.stubGlobal("fetch", fetchA);

    const { unmount } = render(
      <AnlageplanDesignerClient
        board={makeBoard({ id: "board-a", headerSubtitleText: "SUBTITLE A", headerShowWeather: true })}
        tenantName="FC Allschwil"
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /speichern/i })[0]);
    await waitFor(() => expect(fetchA).toHaveBeenCalledTimes(1));
    const bodyA = bodiesA[0] as Record<string, unknown>;
    expect(bodyA.headerSubtitleText).toBe("SUBTITLE A");
    expect(bodyA.headerShowWeather).toBe(true);
    unmount();

    const bodiesB: unknown[] = [];
    const fetchB = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      bodiesB.push(JSON.parse(opts.body as string));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ board: makeBoard({ id: "board-b" }) }),
      });
    });
    vi.stubGlobal("fetch", fetchB);

    render(
      <AnlageplanDesignerClient
        board={makeBoard({ id: "board-b", headerSubtitleText: "SUBTITLE B", headerShowWeather: false })}
        tenantName="FC Allschwil"
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /speichern/i })[0]);
    await waitFor(() => expect(fetchB).toHaveBeenCalledTimes(1));
    const bodyB = bodiesB[0] as Record<string, unknown>;
    expect(bodyB.headerSubtitleText).toBe("SUBTITLE B");
    expect(bodyB.headerShowWeather).toBe(false);

    // Confirm URLs target different boards
    expect((fetchA.mock.calls[0] as [string])[0]).toContain("board-a");
    expect((fetchB.mock.calls[0] as [string])[0]).toContain("board-b");
  });
});

// ── E. Framing — live canvas is 16:9 ─────────────────────────────────────────

describe("E. Screen 2 framing — live canvas uses 16:9 aspect ratio", () => {
  it("anlageplan-map-canvas preserves 16/9 via module CSS", () => {
    const mapCss = readRepoFile("components/infoboard/anlageplan/InfoboardAnlageplan.module.css");
    expect(mapCss).toContain("aspect-ratio: 16 / 9");

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );
    const canvas = screen.getByTestId("anlageplan-map-canvas");
    expect(canvas.className).toContain("mapCanvas");
  });

  it("anlageplan-map-canvas maximizes within the center zone without distortion", () => {
    const mapCss = readRepoFile("components/infoboard/anlageplan/InfoboardAnlageplan.module.css");
    expect(mapCss).toContain("width: min(100cqw, calc(100cqh * 16 / 9))");
    expect(mapCss).toContain("height: min(100cqh, calc(100cqw * 9 / 16))");

    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );
    const canvas = screen.getByTestId("anlageplan-map-canvas");
    expect(canvas.className).toContain("mapCanvas");
  });

  it("anlageplan-map-scene is rendered inside the canvas", () => {
    render(
      <InfoboardAnlageplan
        payload={makeAnlageplanPayload()}
        branding={{ clubName: "FC Allschwil" }}
      />,
    );
    expect(screen.getByTestId("anlageplan-map-scene")).toBeTruthy();
  });

  it("designer canvas uses the same 16:9 aspectRatio as the live canvas", () => {
    render(
      <AnlageplanDesignerClient
        board={makeBoard()}
        tenantName="FC Allschwil"
      />,
    );
    // Designer canvas is the div with aspectRatio: 16/9
    // It renders via inline style on the canvas div (w-full, aspect-ratio: 16/9)
    const canvases = document.querySelectorAll("[style*='aspect-ratio']");
    const has16by9 = Array.from(canvases).some(
      (el) =>
        (el as HTMLElement).style.aspectRatio === "16/9" ||
        (el as HTMLElement).getAttribute("style")?.includes("16 / 9") ||
        (el as HTMLElement).getAttribute("style")?.includes("16/9"),
    );
    expect(has16by9).toBe(true);
  });
});
