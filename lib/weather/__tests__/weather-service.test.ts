import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "../providers/meteoswiss-weather-provider",
  () => ({
    fetchMeteoSwissWeather: vi.fn(),
  }),
);

vi.mock(
  "../providers/meteoswiss-e4-weather-provider",
  () => ({
    fetchMeteoSwissE4Condition: vi.fn(),
  }),
);

import {
  fetchMeteoSwissE4Condition,
} from "../providers/meteoswiss-e4-weather-provider";

import {
  fetchMeteoSwissWeather,
} from "../providers/meteoswiss-weather-provider";

import {
  fetchCurrentWeather,
} from "../weather-service";

const measuredMock =
  vi.mocked(fetchMeteoSwissWeather);

const e4Mock =
  vi.mocked(fetchMeteoSwissE4Condition);

const MEASURED = {
  isAvailable: true as const,
  temperatureC: 19,
  conditionCode: 3,
  conditionLabel: "Aktuelle Messwerte",
  windKmh: 8,
  precipitationProbability: null,
  observedAt:
    "2026-08-17T10:20:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchCurrentWeather — MeteoSwiss only", () => {
  it("keeps measured VQHA80 values authoritative", async () => {
    measuredMock.mockResolvedValue(MEASURED);

    e4Mock.mockResolvedValue({
      isAvailable: true,
      value: {
        symbolCode: 6,
        forecastAt:
          "2026-08-17T10:00:00.000Z",
        conditionCode: 3,
        conditionLabel: "Bewölkt",
      },
    });

    const result =
      await fetchCurrentWeather();

    expect(result).toEqual({
      ...MEASURED,
      conditionCode: 3,
      conditionLabel: "Bewölkt",
    });
  });

  it("uses E4 only for semantic condition enrichment", async () => {
    measuredMock.mockResolvedValue(MEASURED);

    e4Mock.mockResolvedValue({
      isAvailable: true,
      value: {
        symbolCode: 1,
        forecastAt:
          "2026-08-17T10:00:00.000Z",
        conditionCode: 0,
        conditionLabel: "Sonnig",
      },
    });

    const result =
      await fetchCurrentWeather();

    expect(result.isAvailable).toBe(true);

    if (!result.isAvailable) {
      throw new Error("expected weather");
    }

    expect(result.temperatureC).toBe(19);
    expect(result.windKmh).toBe(8);
    expect(result.observedAt).toBe(
      "2026-08-17T10:20:00.000Z",
    );
    expect(result.conditionCode).toBe(0);
    expect(result.conditionLabel).toBe(
      "Sonnig",
    );
  });

  it("falls back to VQHA80-derived condition if E4 is unavailable", async () => {
    measuredMock.mockResolvedValue(MEASURED);

    e4Mock.mockResolvedValue({
      isAvailable: false,
    });

    const result =
      await fetchCurrentWeather();

    expect(result).toEqual(MEASURED);
  });

  it("does not request E4 if VQHA80 itself is unavailable", async () => {
    measuredMock.mockResolvedValue({
      isAvailable: false,
    });

    const result =
      await fetchCurrentWeather();

    expect(result).toEqual({
      isAvailable: false,
    });

    expect(e4Mock).not.toHaveBeenCalled();
  });
});
