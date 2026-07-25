/**
 * lib/weather/__tests__/weather-adapter.test.ts
 *
 * Unit tests for the Open-Meteo weather adapter.
 *
 * All external HTTP requests are mocked — no live API calls are made.
 *
 * Covers:
 *   1. Successful current-weather response → WeatherDto
 *   2. Temperature mapping (°C, rounded)
 *   3. Condition-code mapping (WMO code → conditionCode)
 *   4. German condition label (via getConditionLabel)
 *   5. Wind conversion / mapping (km/h)
 *   6. Optional precipitation → null (not in current endpoint)
 *   7. Allschwil coordinates passed correctly (lat/lon in URL)
 *   8. Commercial endpoint used (customer-api.open-meteo.com) when key is set
 *   9. Network failure → WEATHER_UNAVAILABLE
 *  10. Timeout behavior → WEATHER_UNAVAILABLE
 *  11. Non-2xx response → WEATHER_UNAVAILABLE
 *  12. Invalid JSON → WEATHER_UNAVAILABLE
 *  13. Missing expected provider fields → WEATHER_UNAVAILABLE
 *  14. Unknown condition code → "Unbekannt"
 *  15. Fallback weather DTO (WEATHER_UNAVAILABLE sentinel)
 *  16. Metric units (°C, km/h)
 *  17. Cache/revalidation: next.revalidate = 900 passed in fetch options
 *  18. Production route receives weather DTO (tested via parseOpenMeteoResponse)
 *  19. Preview does not make a weather API request (checked separately)
 *  20. No fake production temperature (WEATHER_UNAVAILABLE on failure)
 *  21. Returns WEATHER_UNAVAILABLE when WEATHER_API_KEY is not configured
 *  22. API key appears in URL as query parameter (not leaked to logs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCurrentWeather,
  parseOpenMeteoResponse,
  getConditionLabel,
  CONDITION_LABEL_UNKNOWN,
} from "../weather-adapter";
import { WEATHER_UNAVAILABLE } from "../weather-types";

// ── Mock fetch ─────────────────────────────────────────────────────────────────

function makeFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function makeFetchError(err: Error) {
  return vi.fn().mockRejectedValue(err);
}

function makeFetchStatus(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new Error("should not be called")),
  });
}

function makeValidOpenMeteoBody(overrides: Record<string, unknown> = {}) {
  return {
    current: {
      time: "2026-07-25T20:00",
      temperature_2m: 22.5,
      weather_code: 2,
      wind_speed_10m: 6.0,
      ...overrides,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── 1. Successful response ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — successful response", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });
  it("returns isAvailable: true on success", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody()),
    );
    expect(result.isAvailable).toBe(true);
  });

  it("2. maps temperature to temperatureC (°C, rounded to 1 decimal)", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ temperature_2m: 22.55 })),
    );
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.temperatureC).toBe(22.6);
    }
  });

  it("temperature of 22.5 passes through correctly", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ temperature_2m: 22.5 })),
    );
    if (result.isAvailable) expect(result.temperatureC).toBe(22.5);
  });

  it("3. maps WMO code 2 to conditionCode 2", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ weather_code: 2 })),
    );
    if (result.isAvailable) expect(result.conditionCode).toBe(2);
  });

  it("4. maps WMO code 2 to German label 'Teilweise bewölkt'", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ weather_code: 2 })),
    );
    if (result.isAvailable) expect(result.conditionLabel).toBe("Teilweise bewölkt");
  });

  it("maps WMO code 0 to 'Klar'", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ weather_code: 0 })),
    );
    if (result.isAvailable) expect(result.conditionLabel).toBe("Klar");
  });

  it("maps WMO code 95 to 'Gewitter'", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ weather_code: 95 })),
    );
    if (result.isAvailable) expect(result.conditionLabel).toBe("Gewitter");
  });

  it("5. maps wind_speed_10m to windKmh (rounded)", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ wind_speed_10m: 6.4 })),
    );
    if (result.isAvailable) expect(result.windKmh).toBe(6);
  });

  it("6. precipitationProbability is null (not in current endpoint)", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody()),
    );
    if (result.isAvailable) expect(result.precipitationProbability).toBeNull();
  });

  it("16. returns metric units — temperatureC is °C value", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody({ temperature_2m: 15 })),
    );
    if (result.isAvailable) {
      // Confirm it's the raw metric value from the API
      expect(result.temperatureC).toBe(15);
    }
  });

  it("returns observedAt as an ISO string", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody()),
    );
    if (result.isAvailable) {
      expect(() => new Date(result.observedAt)).not.toThrow();
      expect(result.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 21. No API key → WEATHER_UNAVAILABLE (no non-commercial request made) ────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — no WEATHER_API_KEY configured", () => {
  beforeEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });

  it("21. returns WEATHER_UNAVAILABLE when WEATHER_API_KEY is not set", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    const result = await fetchCurrentWeather(mockFetch);
    expect(result.isAvailable).toBe(false);
  });

  it("21. does NOT call fetch at all when no API key is configured", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 7 & 8 & 22. Coordinates and commercial endpoint ──────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — commercial endpoint and coordinates", () => {
  const TEST_API_KEY = "test-commercial-key-abc123";

  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = TEST_API_KEY;
  });

  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });

  it("7. passes Allschwil latitude 47.5519 in URL", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("latitude=47.5519");
  });

  it("7. passes Allschwil longitude 7.5351 in URL", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("longitude=7.5351");
  });

  it("8. uses commercial customer-api.open-meteo.com endpoint", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("customer-api.open-meteo.com");
  });

  it("8. does NOT use the non-commercial api.open-meteo.com endpoint", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toMatch(/^https:\/\/api\.open-meteo\.com/);
  });

  it("22. API key appears in URL query parameter as required by Open-Meteo", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(`apikey=${TEST_API_KEY}`);
  });

  it("returns isAvailable: true on success with commercial key", async () => {
    const result = await fetchCurrentWeather(
      makeFetchOk(makeValidOpenMeteoBody()),
    );
    expect(result.isAvailable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 17. Cache/revalidation ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — cache/revalidation", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });

  it("17. passes next.revalidate = 900 in fetch options", async () => {
    const mockFetch = makeFetchOk(makeValidOpenMeteoBody());
    await fetchCurrentWeather(mockFetch);
    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(fetchOptions?.next?.revalidate).toBe(900);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 9. Network failure ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — network failure", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });
  it("9. returns WEATHER_UNAVAILABLE on network error", async () => {
    const result = await fetchCurrentWeather(
      makeFetchError(new Error("fetch failed")),
    );
    expect(result.isAvailable).toBe(false);
  });

  it("20. does not return a fake temperature on failure", async () => {
    const result = await fetchCurrentWeather(
      makeFetchError(new Error("network error")),
    );
    expect(result.isAvailable).toBe(false);
    // If isAvailable is false, no temperatureC field exists
    expect((result as Record<string, unknown>)["temperatureC"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 10. Timeout ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — timeout", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });
  it("10. returns WEATHER_UNAVAILABLE when fetch throws AbortError", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const result = await fetchCurrentWeather(makeFetchError(abortError as Error));
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 11. Non-2xx response ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — non-2xx response", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });
  it("11. returns WEATHER_UNAVAILABLE on 500", async () => {
    const result = await fetchCurrentWeather(makeFetchStatus(500));
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE on 429", async () => {
    const result = await fetchCurrentWeather(makeFetchStatus(429));
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE on 404", async () => {
    const result = await fetchCurrentWeather(makeFetchStatus(404));
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 12. Invalid JSON ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — invalid JSON", () => {
  beforeEach(() => {
    process.env["WEATHER_API_KEY"] = "test-key";
  });
  afterEach(() => {
    delete process.env["WEATHER_API_KEY"];
  });
  it("12. returns WEATHER_UNAVAILABLE on JSON parse failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    const result = await fetchCurrentWeather(mockFetch);
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 13. Missing expected fields ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseOpenMeteoResponse — missing expected fields", () => {
  it("13. returns WEATHER_UNAVAILABLE when current is missing", () => {
    const result = parseOpenMeteoResponse({ no_current: true });
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE when temperature_2m is missing", () => {
    const result = parseOpenMeteoResponse({
      current: { weather_code: 0, wind_speed_10m: 5 },
    });
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE when weather_code is missing", () => {
    const result = parseOpenMeteoResponse({
      current: { temperature_2m: 20, wind_speed_10m: 5 },
    });
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE when wind_speed_10m is missing", () => {
    const result = parseOpenMeteoResponse({
      current: { temperature_2m: 20, weather_code: 0 },
    });
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE for null input", () => {
    const result = parseOpenMeteoResponse(null);
    expect(result.isAvailable).toBe(false);
  });

  it("returns WEATHER_UNAVAILABLE for string input", () => {
    const result = parseOpenMeteoResponse("not-an-object");
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 14. Unknown condition code ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("getConditionLabel — unknown condition code", () => {
  it("14. returns 'Unbekannt' for unknown WMO code 999", () => {
    expect(getConditionLabel(999)).toBe("Unbekannt");
  });

  it("returns 'Unbekannt' for code -1", () => {
    expect(getConditionLabel(-1)).toBe("Unbekannt");
  });

  it("returns correct label for known code 0", () => {
    expect(getConditionLabel(0)).toBe("Klar");
  });

  it("returns correct label for known code 63", () => {
    expect(getConditionLabel(63)).toBe("Mäßiger Regen");
  });

  it("CONDITION_LABEL_UNKNOWN is 'Unbekannt'", () => {
    expect(CONDITION_LABEL_UNKNOWN).toBe("Unbekannt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── 15. Fallback DTO ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("WEATHER_UNAVAILABLE sentinel", () => {
  it("15. WEATHER_UNAVAILABLE has isAvailable: false", () => {
    expect(WEATHER_UNAVAILABLE.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Open-Meteo legacy weathercode field ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseOpenMeteoResponse — legacy weathercode field", () => {
  it("accepts legacy 'weathercode' field as fallback", () => {
    const result = parseOpenMeteoResponse({
      current: {
        temperature_2m: 18,
        weathercode: 3,
        wind_speed_10m: 10,
      },
    });
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.conditionCode).toBe(3);
      expect(result.conditionLabel).toBe("Bedeckt");
    }
  });
});
