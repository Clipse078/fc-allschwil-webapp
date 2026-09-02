/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { KioskShellWeatherDisplay } from "@/components/infoboard/shared/KioskShellWeatherDisplay";
import { WEATHER_UNAVAILABLE, type WeatherDto } from "@/lib/weather/weather-types";

const AVAILABLE_WEATHER: WeatherDto = {
  isAvailable: true,
  temperatureC: 18.6,
  conditionCode: 61,
  conditionLabel: "Häufige Regenschauer",
  windKmh: 10,
  precipitationProbability: null,
  observedAt: "2026-08-31T14:30:00.000Z",
};

describe("KioskShellWeatherDisplay", () => {
  it("renders rounded temperature and condition label", () => {
    render(<KioskShellWeatherDisplay weather={AVAILABLE_WEATHER} />);

    expect(screen.getByTestId("header-weather-temperature").textContent).toBe("19°");
    expect(screen.getByTestId("header-weather-condition").textContent).toBe(
      "Häufige Regenschauer",
    );
    expect(screen.getByTestId("header-weather").querySelector("svg")).toBeTruthy();
  });

  it("returns null for unavailable weather without crashing", () => {
    const { container } = render(
      <KioskShellWeatherDisplay weather={WEATHER_UNAVAILABLE} />,
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("useKioskWeather", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        isAvailable: true,
        temperatureC: 20,
        conditionCode: 0,
        conditionLabel: "Sonnig",
        windKmh: 5,
        precipitationProbability: null,
        observedAt: "2026-08-31T15:00:00.000Z",
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("LiveKioskShellWeather refreshes from the public API when live", async () => {
    vi.useFakeTimers();

    const { LiveKioskShellWeather } = await import(
      "@/components/infoboard/shared/LiveKioskShellWeather"
    );

    render(<LiveKioskShellWeather initialWeather={AVAILABLE_WEATHER} live={true} />);

    expect(screen.getByTestId("header-weather-temperature").textContent).toBe("19°");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledWith("/api/public/infoboard/weather", {
      cache: "no-store",
    });

    vi.useRealTimers();
  });
});
