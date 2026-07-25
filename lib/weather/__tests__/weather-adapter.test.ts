/**
 * lib/weather/__tests__/weather-adapter.test.ts
 *
 * Tests for the re-exported Open-Meteo helpers from weather-adapter.ts.
 *
 * NOTE: fetchCurrentWeather is now the MeteoSwiss provider (WEATHER-01).
 * Open-Meteo-specific tests for fetchCurrentWeather are preserved in
 * lib/weather/__tests__/open-meteo-provider.test.ts.
 * MeteoSwiss-specific tests are in lib/weather/__tests__/meteoswiss-provider.test.ts.
 * Service-level tests are in lib/weather/__tests__/weather-service.test.ts.
 *
 * This file keeps backward-compat coverage for:
 *   – parseOpenMeteoResponse (re-exported from open-meteo-weather-provider)
 *   – getConditionLabel (re-exported from open-meteo-weather-provider)
 *   – CONDITION_LABEL_UNKNOWN (re-exported from open-meteo-weather-provider)
 */

import { describe, it, expect } from "vitest";
import {
  parseOpenMeteoResponse,
  getConditionLabel,
  CONDITION_LABEL_UNKNOWN,
} from "../weather-adapter";
import { WEATHER_UNAVAILABLE } from "../weather-types";

// ─────────────────────────────────────────────────────────────────────────────
// ── parseOpenMeteoResponse ────────────────────────────────────────────────────
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

describe("parseOpenMeteoResponse — successful parse", () => {
  it("parses temperature, condition code, and wind correctly", () => {
    const result = parseOpenMeteoResponse({
      current: {
        time: "2026-07-25T20:00",
        temperature_2m: 22.5,
        weather_code: 2,
        wind_speed_10m: 6.0,
      },
    });
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.temperatureC).toBe(22.5);
      expect(result.conditionCode).toBe(2);
      expect(result.conditionLabel).toBe("Teilweise bewölkt");
      expect(result.windKmh).toBe(6);
    }
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// ── getConditionLabel ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("getConditionLabel — known codes", () => {
  it("returns 'Klar' for code 0", () => {
    expect(getConditionLabel(0)).toBe("Klar");
  });

  it("returns 'Überwiegend klar' for code 1", () => {
    expect(getConditionLabel(1)).toBe("Überwiegend klar");
  });

  it("returns 'Teilweise bewölkt' for code 2", () => {
    expect(getConditionLabel(2)).toBe("Teilweise bewölkt");
  });

  it("returns 'Bedeckt' for code 3", () => {
    expect(getConditionLabel(3)).toBe("Bedeckt");
  });

  it("returns 'Mäßiger Regen' for code 63", () => {
    expect(getConditionLabel(63)).toBe("Mäßiger Regen");
  });

  it("returns 'Gewitter' for code 95", () => {
    expect(getConditionLabel(95)).toBe("Gewitter");
  });
});

describe("getConditionLabel — unknown codes", () => {
  it("14. returns 'Unbekannt' for unknown WMO code 999", () => {
    expect(getConditionLabel(999)).toBe("Unbekannt");
  });

  it("returns 'Unbekannt' for code -1", () => {
    expect(getConditionLabel(-1)).toBe("Unbekannt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── CONDITION_LABEL_UNKNOWN ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("CONDITION_LABEL_UNKNOWN sentinel", () => {
  it("CONDITION_LABEL_UNKNOWN is 'Unbekannt'", () => {
    expect(CONDITION_LABEL_UNKNOWN).toBe("Unbekannt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── WEATHER_UNAVAILABLE sentinel ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("WEATHER_UNAVAILABLE sentinel", () => {
  it("15. WEATHER_UNAVAILABLE has isAvailable: false", () => {
    expect(WEATHER_UNAVAILABLE.isAvailable).toBe(false);
  });
});
