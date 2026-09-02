/**
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WeatherDto } from "@/lib/weather/weather-types";

const mocks = vi.hoisted(() => ({
  fetchCurrentWeather: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock("@/lib/weather/weather-service", () => ({
  fetchCurrentWeather: mocks.fetchCurrentWeather,
}));

import { getCanonicalKioskWeather } from "@/lib/infoboard/kiosk-weather";

const CANONICAL_WEATHER: WeatherDto = {
  isAvailable: true,
  temperatureC: 18,
  conditionCode: 61,
  conditionLabel: "Häufige Regenschauer",
  windKmh: 12,
  precipitationProbability: null,
  observedAt: "2026-08-31T14:30:00.000Z",
};

describe("getCanonicalKioskWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchCurrentWeather.mockResolvedValue(CANONICAL_WEATHER);
  });

  it("delegates to fetchCurrentWeather", async () => {
    const result = await getCanonicalKioskWeather();

    expect(mocks.fetchCurrentWeather).toHaveBeenCalledTimes(1);
    expect(result).toEqual(CANONICAL_WEATHER);
  });
});
