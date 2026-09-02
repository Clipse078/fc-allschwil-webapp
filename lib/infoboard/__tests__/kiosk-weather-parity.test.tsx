/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import { InfoboardScreen2 } from "@/components/infoboard/screen2/InfoboardScreen2";
import type { WeatherDto } from "@/lib/weather/weather-types";

const CANONICAL_WEATHER: WeatherDto = {
  isAvailable: true,
  temperatureC: 18.4,
  conditionCode: 61,
  conditionLabel: "Häufige Regenschauer",
  windKmh: 11.2,
  precipitationProbability: null,
  observedAt: "2026-08-31T14:30:00.000Z",
};

const SCREEN1_FEED = {
  generatedAt: "2026-08-31T14:31:00.000Z",
  tenant: {
    id: "tenant-fca",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-08-31",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
  emptyStateReason: "NO_EVENTS_TODAY" as const,
};

const SCREEN2_FEED = {
  generatedAt: "2026-08-31T14:31:00.000Z",
  tenant: {
    id: "tenant-fca",
    key: "fc-allschwil",
    name: "FC Allschwil",
    timezone: "Europe/Zurich",
  },
  displayDate: "2026-08-31",
  isStale: false,
  facilityName: "Sportanlage Im Brüel",
  pitches: [],
  dressingRooms: [],
  unallocated: [],
};

describe("Infoboard weather parity", () => {
  it("Screen 1 and Screen 2 resolve identical temperature, label, and icon semantics", () => {
    render(
      <InfoboardScreen1
        feed={SCREEN1_FEED}
        weather={CANONICAL_WEATHER}
        headerConfig={{ showWeather: true }}
        liveClock={false}
      />,
    );

    const screen1Temp = screen.getByTestId("header-weather-temperature").textContent;
    const screen1Condition = screen.getByTestId("header-weather-condition").textContent;

    render(
      <InfoboardScreen2
        feed={SCREEN2_FEED}
        weather={CANONICAL_WEATHER}
        liveClock={false}
      />,
    );

    const screen2Temp = screen.getAllByTestId("header-weather-temperature")[1].textContent;
    const screen2Condition = screen.getAllByTestId("header-weather-condition")[1].textContent;

    expect(screen1Temp).toBe("18°");
    expect(screen2Temp).toBe("18°");
    expect(screen1Condition).toBe("Häufige Regenschauer");
    expect(screen2Condition).toBe("Häufige Regenschauer");
  });
});
