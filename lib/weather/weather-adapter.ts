/**
 * lib/weather/weather-adapter.ts
 *
 * Server-side weather adapter — Open-Meteo (https://open-meteo.com).
 *
 * Commercial use:
 *   SportClubEvo is a commercial SaaS. The Open-Meteo free endpoint
 *   (api.open-meteo.com) is restricted to non-commercial use under its
 *   terms. Commercial use requires a paid subscription and the dedicated
 *   customer endpoint (customer-api.open-meteo.com) with an API key.
 *
 *   This adapter enforces that:
 *     - If WEATHER_API_KEY is NOT set, weather is disabled (returns
 *       WEATHER_UNAVAILABLE). No request to the non-commercial endpoint
 *       is ever made.
 *     - If WEATHER_API_KEY IS set, the commercial customer endpoint is
 *       used with the key as a query parameter. The key is server-side
 *       only and is never logged, rendered in HTML, or exposed to clients.
 *
 *   To activate weather: subscribe to the Open-Meteo API Standard plan at
 *   https://open-meteo.com/en/pricing, obtain the API key, and set the
 *   WEATHER_API_KEY environment variable on the server.
 *
 * Provider:
 *   Open-Meteo (https://open-meteo.com)
 *   Commercial endpoint: https://customer-api.open-meteo.com/v1/forecast
 *   Attribution required: "Wetterdaten: Open-Meteo.com" (CC BY 4.0).
 *
 * Cache strategy:
 *   Next.js fetch cache with `next: { revalidate: 900 }` (15 min).
 *   Both infoboard screens share the same cached response.
 *   A recent cached value is served on transient provider failure.
 *
 * Facility location:
 *   Sportanlage Im Brüel, Allschwil, Basel-Landschaft, Switzerland.
 *   Coordinates are fixed server-side; browser geolocation is never used.
 *   Env vars WEATHER_LAT / WEATHER_LON override the defaults for portability.
 *
 * Design constraints:
 *   - WEATHER_API_KEY is never committed, logged, or exposed to clients.
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

/**
 * Commercial customer endpoint hostname.
 * Requires a valid WEATHER_API_KEY from an Open-Meteo paid subscription.
 * The free endpoint (api.open-meteo.com) must not be used for commercial SaaS.
 */
const COMMERCIAL_HOST = "customer-api.open-meteo.com";

/**
 * Builds the commercial Open-Meteo URL.
 * The API key is included as a query parameter as required by Open-Meteo.
 * The key is never logged; callers must not include the returned URL in logs.
 */
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
 * Requires WEATHER_API_KEY to be set (commercial Open-Meteo subscription).
 * If the key is absent, returns WEATHER_UNAVAILABLE immediately without
 * making any request to a non-commercial endpoint.
 *
 * @param fetchFn - Injected fetch function. Defaults to `globalThis.fetch`.
 *   Supply a mock in tests to avoid network calls.
 * @returns A WeatherResult. Returns WEATHER_UNAVAILABLE on any failure or
 *   when no commercial API key is configured.
 */
export async function fetchCurrentWeather(
  fetchFn: FetchFn = globalThis.fetch as FetchFn,
): Promise<WeatherResult> {
  const apiKey = process.env["WEATHER_API_KEY"];

  if (!apiKey) {
    // No commercial API key configured. The free Open-Meteo endpoint may not
    // be used for commercial SaaS. Weather is unavailable until a valid
    // WEATHER_API_KEY is set (Open-Meteo API Standard plan or higher).
    return WEATHER_UNAVAILABLE;
  }

  const lat = process.env["WEATHER_LAT"] ?? DEFAULT_LAT;
  const lon = process.env["WEATHER_LON"] ?? DEFAULT_LON;
  const url = buildOpenMeteoUrl(lat, lon, apiKey);

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
