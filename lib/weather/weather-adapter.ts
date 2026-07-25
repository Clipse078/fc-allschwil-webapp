/**
 * lib/weather/weather-adapter.ts
 *
 * Server-side weather adapter — Open-Meteo (https://open-meteo.com).
 *
 * Provider selection rationale:
 *   Provider:       Open-Meteo (open-source weather API)
 *   Endpoint:       https://api.open-meteo.com/v1/forecast
 *   Authentication: None — Open-Meteo is free for non-commercial use with
 *                   no API key requirement.
 *   Rate limits:    No documented hard limit; 10,000 req/day typical free tier.
 *                   The 15-minute Next.js cache keeps actual request volume
 *                   well within any reasonable limit for two infoboard screens.
 *   Attribution:    "Weather data by Open-Meteo.com" (open-source, CC BY 4.0).
 *   Cache strategy: Next.js fetch cache with `next: { revalidate: 900 }` (15 min).
 *                   Both infoboard screens share the same cached response.
 *                   A recent cached value is served on transient provider failure.
 *   Fallback:       On any error (network, timeout, non-2xx, invalid JSON, or
 *                   missing fields), returns WEATHER_UNAVAILABLE. No request loop.
 *
 * Facility location:
 *   Sportanlage Im Brüel, Allschwil, Basel-Landschaft, Switzerland.
 *   Coordinates are fixed server-side; browser geolocation is never used.
 *   Env vars WEATHER_LAT / WEATHER_LON override the defaults for portability.
 *
 * Design constraints:
 *   - No API key committed or exposed in client-side JavaScript.
 *   - The fetch function is injected for testability (default: globalThis.fetch).
 *   - Only current-conditions fields are requested — no forecast.
 *   - All temperature values are °C, wind values are km/h.
 *   - Conditions are mapped to German labels from WMO weather codes.
 *   - Any unrecognised code returns "Unbekannt".
 *   - Network errors and timeouts are caught and logged (without exposing secrets).
 *   - The provider payload is never forwarded to presentation components.
 */

import { WEATHER_UNAVAILABLE, type WeatherResult } from "./weather-types";

// ── Facility coordinates ──────────────────────────────────────────────────────

/**
 * Default latitude for Sportanlage Im Brüel, Allschwil.
 * Can be overridden via WEATHER_LAT env var.
 */
const DEFAULT_LAT = "47.5519";

/**
 * Default longitude for Sportanlage Im Brüel, Allschwil.
 * Can be overridden via WEATHER_LON env var.
 */
const DEFAULT_LON = "7.5351";

// ── Open-Meteo API ────────────────────────────────────────────────────────────

/** Cache revalidation interval in seconds (15 minutes). */
const REVALIDATE_SECONDS = 900;

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 8_000;

/** Open-Meteo current-conditions variables. */
const CURRENT_VARS = "temperature_2m,weather_code,wind_speed_10m";

function buildOpenMeteoUrl(lat: string, lon: string): string {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: CURRENT_VARS,
    wind_speed_unit: "kmh",
    timezone: "UTC",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

// ── WMO weather code → German condition label ─────────────────────────────────

/**
 * WMO weather interpretation codes mapped to German condition labels.
 * Source: WMO code table 4677 / Open-Meteo documentation.
 * Any code absent from this map renders as CONDITION_LABEL_UNKNOWN.
 */
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

/** German label returned when the WMO code is not in the mapping table. */
export const CONDITION_LABEL_UNKNOWN = "Unbekannt";

/**
 * Maps a WMO weather code to a German condition label.
 * Returns CONDITION_LABEL_UNKNOWN for any unmapped code.
 */
export function getConditionLabel(code: number): string {
  return WMO_DE[code] ?? CONDITION_LABEL_UNKNOWN;
}

// ── Open-Meteo response shape ─────────────────────────────────────────────────

type OpenMeteoCurrentResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    /** Open-Meteo v1 uses weather_code. */
    weather_code?: number;
    /** Some older versions used weathercode. */
    weathercode?: number;
    wind_speed_10m?: number;
  };
};

// ── fetchCurrentWeather ───────────────────────────────────────────────────────

export type FetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Fetches current weather for the configured facility location.
 *
 * @param fetchFn - Injected fetch function. Defaults to `globalThis.fetch`.
 *   Supply a mock in tests to avoid network calls.
 * @returns A WeatherResult. Returns WEATHER_UNAVAILABLE on any failure.
 */
export async function fetchCurrentWeather(
  fetchFn: FetchFn = globalThis.fetch as FetchFn,
): Promise<WeatherResult> {
  const lat = process.env["WEATHER_LAT"] ?? DEFAULT_LAT;
  const lon = process.env["WEATHER_LON"] ?? DEFAULT_LON;
  const url = buildOpenMeteoUrl(lat, lon);

  let response: { ok: boolean; status: number; json: () => Promise<unknown> };

  try {
    response = await fetchFn(url, {
      // Next.js fetch cache: reuse the cached response for 15 minutes.
      // Both infoboard screens share the same cached API response.
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as RequestInit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[weather-adapter] Network or timeout error:", message);
    return WEATHER_UNAVAILABLE;
  }

  if (!response.ok) {
    console.error(
      `[weather-adapter] Provider returned non-2xx status: ${response.status}`,
    );
    return WEATHER_UNAVAILABLE;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    console.error("[weather-adapter] Failed to parse JSON response");
    return WEATHER_UNAVAILABLE;
  }

  return parseOpenMeteoResponse(raw);
}

/**
 * Parses the Open-Meteo response into a WeatherResult.
 * Exported for unit testing without network calls.
 */
export function parseOpenMeteoResponse(raw: unknown): WeatherResult {
  if (!raw || typeof raw !== "object") {
    console.error("[weather-adapter] Unexpected response shape (not an object)");
    return WEATHER_UNAVAILABLE;
  }

  const data = raw as OpenMeteoCurrentResponse;
  const current = data.current;

  if (!current || typeof current !== "object") {
    console.error("[weather-adapter] Missing 'current' field in response");
    return WEATHER_UNAVAILABLE;
  }

  const temperatureC = current.temperature_2m;
  const conditionCode =
    current.weather_code ?? current.weathercode;
  const windKmh = current.wind_speed_10m;
  const observedAt = current.time;

  if (
    typeof temperatureC !== "number" ||
    typeof conditionCode !== "number" ||
    typeof windKmh !== "number"
  ) {
    console.error(
      "[weather-adapter] Missing required numeric fields in response",
    );
    return WEATHER_UNAVAILABLE;
  }

  const observedAtIso =
    typeof observedAt === "string" && observedAt.length > 0
      ? // Open-Meteo returns local time without offset; append Z for UTC.
        observedAt.includes("T")
        ? `${observedAt}:00Z`
        : new Date().toISOString()
      : new Date().toISOString();

  return {
    isAvailable: true,
    temperatureC: Math.round(temperatureC * 10) / 10,
    conditionCode,
    conditionLabel: getConditionLabel(conditionCode),
    windKmh: Math.round(windKmh),
    precipitationProbability: null,
    observedAt: observedAtIso,
  };
}
