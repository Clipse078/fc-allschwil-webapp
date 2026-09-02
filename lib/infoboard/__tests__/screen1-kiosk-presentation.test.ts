/**
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildScreen1KioskPresentation } from "@/lib/infoboard/screen1-kiosk-presentation";

const mocks = vi.hoisted(() => ({
  buildScreen1LivePayload: vi.fn(),
  fetchCurrentWeather: vi.fn(),
  buildBoardConfig: vi.fn(),
}));

vi.mock("@/lib/publishing/infoboard/screen1-live-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/publishing/infoboard/screen1-live-service")
  >("@/lib/publishing/infoboard/screen1-live-service");
  return {
    ...actual,
    buildScreen1LivePayload: mocks.buildScreen1LivePayload,
  };
});

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock("@/lib/weather/weather-service", () => ({
  fetchCurrentWeather: mocks.fetchCurrentWeather,
}));

vi.mock("@/lib/infoboard/board-config", () => ({
  buildBoardConfig: mocks.buildBoardConfig,
}));

const TENANT = {
  id: "tenant-1",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
};

const WEATHER = {
  isAvailable: true as const,
  temperatureC: 19,
  conditionCode: 2,
  conditionLabel: "Teilweise sonnig",
  windKmh: 8,
  precipitationProbability: null,
  observedAt: "2026-08-28T12:00:00.000Z",
};

const PAYLOAD = {
  feed: {
    generatedAt: "2026-08-28T12:00:00.000Z",
    tenant: TENANT,
    displayDate: "2026-08-28",
    isStale: false,
    wochenplanVariantBadge: null,
    current: [],
    next: [],
    later: [],
    isEmpty: true,
    emptyStateReason: "NO_EVENTS_TODAY",
  },
  eventPresentation: [],
  announcement: null,
  branding: { clubLogoSrc: null, productLogoSrc: "/logo.png" },
  currentTimeIso: "2026-08-28T12:00:00.000Z",
  theme: "DARK" as const,
  headerConfig: {
    subtitleEnabled: true,
    subtitleText: "Heute",
    showTime: true,
    showDate: true,
    showWeather: true,
  },
  presentation: null,
  studio: null,
};

describe("buildScreen1KioskPresentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildScreen1LivePayload.mockResolvedValue(PAYLOAD);
    mocks.fetchCurrentWeather.mockResolvedValue(WEATHER);
    mocks.buildBoardConfig.mockReturnValue({ headerShowWeather: true });
  });

  it("passes weather and headerConfig through to InfoboardScreen1 props", async () => {
    const loader = vi.fn();
    const now = new Date("2026-08-28T12:00:00.000Z");
    const board = { id: "board-1" };

    const result = await buildScreen1KioskPresentation({
      tenant: TENANT,
      now,
      loader,
      board,
    });

    expect(result.infoboardScreen1Props.weather).toEqual(WEATHER);
    expect(result.infoboardScreen1Props.headerConfig?.showWeather).toBe(true);
    expect(mocks.buildBoardConfig).toHaveBeenCalledWith(board);
  });

  it("uses the same weather input for preview and kiosk when supplied explicitly", async () => {
    mocks.buildScreen1LivePayload.mockResolvedValue({
      ...PAYLOAD,
      headerConfig: {
        ...PAYLOAD.headerConfig,
        showWeather: false,
      },
    });
    const unavailable = { isAvailable: false as const };
    const result = await buildScreen1KioskPresentation({
      tenant: TENANT,
      now: new Date("2026-08-28T12:00:00.000Z"),
      loader: vi.fn(),
      boardConfig: { headerShowWeather: false },
      weather: unavailable,
    });

    expect(mocks.fetchCurrentWeather).not.toHaveBeenCalled();
    expect(result.weather).toEqual(unavailable);
    expect(result.infoboardScreen1Props.headerConfig?.showWeather).toBe(false);
  });
});
