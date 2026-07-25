/**
 * lib/weather/weather-service.ts
 *
 * Provider-neutral weather service for Infoboard Screen 2.
 *
 * Active provider:  MeteoSwiss Open Data (SwissMetNet VQHA80)
 * Dormant fallback: Open-Meteo (commercial, requires WEATHER_API_KEY)
 *
 * Design constraints:
 *   – Screen 2 calls fetchCurrentWeather() from this module.
 *   – The component does NOT know which provider is active.
 *   – MeteoSwiss is the default active Swiss provider — no secrets required.
 *   – Open-Meteo is preserved as a dormant implementation; it cannot
 *     activate without explicit configuration (WEATHER_API_KEY) AND an
 *     explicit change to ACTIVE_PROVIDER in this file.
 *   – No tenant-facing provider selector.
 *   – No Prisma changes.
 *   – No database configuration.
 *
 * To switch providers (future):
 *   Change ACTIVE_PROVIDER from "meteoswiss" to "open-meteo".
 *   Open-Meteo also requires WEATHER_API_KEY to be set.
 */

import { fetchMeteoSwissWeather } from "./providers/meteoswiss-weather-provider";
import { type WeatherResult } from "./weather-types";

// ── Active provider ───────────────────────────────────────────────────────────

/**
 * Active provider identifier.
 * "meteoswiss" — MeteoSwiss Open Data (SwissMetNet), no key required.
 * "open-meteo" — Open-Meteo commercial API, requires WEATHER_API_KEY.
 */
const ACTIVE_PROVIDER = "meteoswiss" as const;

// ── fetchCurrentWeather ───────────────────────────────────────────────────────

/**
 * Fetches current weather for Sportanlage Im Brüel, Allschwil.
 *
 * Returns a WeatherResult from the active provider, or WEATHER_UNAVAILABLE
 * on any failure. The caller does not need to know which provider is active.
 *
 * @param fetchFn - Optional injected fetch function for testability.
 *   Type is `unknown` to accept both the MeteoSwiss and Open-Meteo fetch
 *   signatures without leaking provider-specific types to callers.
 */
export async function fetchCurrentWeather(
  fetchFn?: unknown,
): Promise<WeatherResult> {
  if (ACTIVE_PROVIDER === "meteoswiss") {
    return fetchMeteoSwissWeather(
      fetchFn as Parameters<typeof fetchMeteoSwissWeather>[0],
    );
  }
  // open-meteo branch preserved for future use — not reachable with current config.
  // To activate: change ACTIVE_PROVIDER above and ensure WEATHER_API_KEY is set.
  const { fetchOpenMeteoWeather } = await import(
    "./providers/open-meteo-weather-provider"
  );
  return fetchOpenMeteoWeather(
    fetchFn as Parameters<typeof fetchOpenMeteoWeather>[0],
  );
}
