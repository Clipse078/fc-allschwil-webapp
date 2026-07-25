/**
 * lib/weather/providers/open-meteo-weather-provider.ts
 *
 * DORMANT — Not active for FC Allschwil.
 *
 * Legacy Open-Meteo commercial provider (preserved as a dormant fallback).
 * MeteoSwiss is the default active provider for Swiss tenants.
 *
 * Activation requires:
 *   – A paid Open-Meteo API Standard subscription (https://open-meteo.com/en/pricing).
 *   – Setting WEATHER_API_KEY to the issued API key (server-side only).
 *   – Explicitly switching the provider in weather-service.ts.
 *
 * This module does NOT activate unless explicitly called with a valid API key.
 * The weather-service.ts does NOT call this provider by default.
 *
 * ─── Commercial-use note ────────────────────────────────────────────────────
 * SportClubEvo is a commercial SaaS. The Open-Meteo free endpoint
 * (api.open-meteo.com) is restricted to non-commercial use. Commercial
 * use requires the dedicated customer endpoint (customer-api.open-meteo.com)
 * with a paid API key. This adapter enforces the requirement: if
 * WEATHER_API_KEY is not set, it returns WEATHER_UNAVAILABLE immediately
 * without making any request.
 *
 * ─── Attribution ────────────────────────────────────────────────────────────
 * If this provider is activated, replace the MeteoSwiss attribution in
 * InfoboardScreen2.tsx with: "Wetterdaten: Open-Meteo.com" (CC BY 4.0).
 */

import { WEATHER_UNAVAILABLE, type WeatherResult } from "../weather-types";

// ── Open-Meteo API ────────────────────────────────────────────────────────────

const COMMERCIAL_HOST = "customer-api.open-meteo.com";
const REVALIDATE_SECONDS = 900;
const TIMEOUT_MS = 8_000;
const CURRENT_VARS = "temperature_2m,weather_code,wind_speed_10m";

function buildOpenMeteoUrl(lat: string, lon: string, apiKey: string): string {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: CURRENT_VARS,
    wind_speed_unit: "kmh",
    timezone: "UTC",
    apikey: apiKey,
  });
  return `https://${COMMERCIAL_HOST}/v1/forecast?${params.toString()}`;
}

const WMO_DE: Readonly<Record<number, string>> = {
  0:  "Klar",
  1:  "Überwiegend klar",
  2:  "Teilweise bewölkt",
  3:  "Bedeckt",
  45: "Nebel",
  48: "Ablagerungsnebel",
  51: "Leichter Nieselregen",
  53: "Mäßiger Nieselregen",
  55: "Dichter Nieselregen",
  56: "Gefrierender Nieselregen",
  57: "Starker gefrierender Nieselregen",
  61: "Leichter Regen",
  63: "Mäßiger Regen",
  65: "Starker Regen",
  66: "Gefrierender Regen",
  67: "Starker gefrierender Regen",
  71: "Leichter Schneefall",
  73: "Mäßiger Schneefall",
  75: "Starker Schneefall",
  77: "Schneekörner",
  80: "Leichte Regenschauer",
  81: "Mäßige Regenschauer",
  82: "Starke Regenschauer",
  85: "Leichte Schneeschauer",
  86: "Starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter mit Hagel",
  99: "Gewitter mit starkem Hagel",
};

export const OPEN_METEO_CONDITION_LABEL_UNKNOWN = "Unbekannt";

export function getOpenMeteoConditionLabel(code: number): string {
  return WMO_DE[code] ?? OPEN_METEO_CONDITION_LABEL_UNKNOWN;
}

type OpenMeteoCurrentResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
    weathercode?: number;
    wind_speed_10m?: number;
  };
};

export type FetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function parseOpenMeteoResponse(raw: unknown): WeatherResult {
  if (!raw || typeof raw !== "object") {
    console.error("[open-meteo] Unexpected response shape (not an object)");
    return WEATHER_UNAVAILABLE;
  }

  const data = raw as OpenMeteoCurrentResponse;
  const current = data.current;

  if (!current || typeof current !== "object") {
    console.error("[open-meteo] Missing 'current' field in response");
    return WEATHER_UNAVAILABLE;
  }

  const temperatureC = current.temperature_2m;
  const conditionCode = current.weather_code ?? current.weathercode;
  const windKmh = current.wind_speed_10m;
  const observedAt = current.time;

  if (
    typeof temperatureC !== "number" ||
    typeof conditionCode !== "number" ||
    typeof windKmh !== "number"
  ) {
    console.error("[open-meteo] Missing required numeric fields in response");
    return WEATHER_UNAVAILABLE;
  }

  const observedAtIso =
    typeof observedAt === "string" && observedAt.length > 0
      ? observedAt.includes("T")
        ? `${observedAt}:00Z`
        : new Date().toISOString()
      : new Date().toISOString();

  return {
    isAvailable: true,
    temperatureC: Math.round(temperatureC * 10) / 10,
    conditionCode,
    conditionLabel: getOpenMeteoConditionLabel(conditionCode),
    windKmh: Math.round(windKmh),
    precipitationProbability: null,
    observedAt: observedAtIso,
  };
}

/**
 * Fetches current weather from the Open-Meteo commercial API.
 *
 * DORMANT: This function is NOT called by the active weather service.
 * Returns WEATHER_UNAVAILABLE immediately when WEATHER_API_KEY is not set,
 * ensuring the free (non-commercial) endpoint is never used.
 */
export async function fetchOpenMeteoWeather(
  fetchFn: FetchFn = globalThis.fetch as FetchFn,
): Promise<WeatherResult> {
  const apiKey = process.env["WEATHER_API_KEY"];
  if (!apiKey) {
    return WEATHER_UNAVAILABLE;
  }

  const lat = process.env["WEATHER_LAT"] ?? "47.5519";
  const lon = process.env["WEATHER_LON"] ?? "7.5351";
  const url = buildOpenMeteoUrl(lat, lon, apiKey);

  let response: { ok: boolean; status: number; json: () => Promise<unknown> };

  try {
    response = await fetchFn(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as RequestInit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[open-meteo] Network or timeout error:", message);
    return WEATHER_UNAVAILABLE;
  }

  if (!response.ok) {
    console.error(`[open-meteo] Provider returned non-2xx status: ${response.status}`);
    return WEATHER_UNAVAILABLE;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    console.error("[open-meteo] Failed to parse JSON response");
    return WEATHER_UNAVAILABLE;
  }

  return parseOpenMeteoResponse(raw);
}
