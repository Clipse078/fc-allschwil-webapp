/**
 * lib/infoboard/kiosk-weather.ts
 *
 * Canonical kiosk weather resolution for all Infoboard screens.
 *
 * Both Screen 1 and Screen 2 (including Anlageplan) must consume the same
 * normalized weather state. This module is the single server-side entry point
 * for kiosk pages, preview hosts, and the public refresh API.
 *
 * Location (FC Allschwil / Sportanlage Im Brüel):
 *   - Measured temperature/wind: MeteoSwiss VQHA80 station BAS (Basel/Binningen)
 *   - Semantic condition enrichment: MeteoSwiss E4 local forecast point 412300 (Allschwil)
 *
 * Cache/freshness:
 *   - unstable_cache revalidate: 600 s (matches VQHA80 update cadence)
 *   - Provider fetch revalidate: 600 s (VQHA80) / 3600 s (E4 condition only)
 */

import { unstable_cache } from "next/cache";
import { fetchCurrentWeather } from "@/lib/weather/weather-service";
import {
  METEOSWISS_STATION,
  REVALIDATE_SECONDS,
} from "@/lib/weather/providers/meteoswiss-weather-provider";
import { METEOSWISS_E4_POINT_ID } from "@/lib/weather/providers/meteoswiss-e4-weather-provider";
import type { WeatherResult } from "@/lib/weather/weather-types";

export const CANONICAL_KIOSK_WEATHER_CACHE_TAG = "infoboard-canonical-kiosk-weather";

/** Shared refresh interval for kiosk weather polling (10 minutes). */
export const CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS = REVALIDATE_SECONDS;

export const CANONICAL_KIOSK_WEATHER_LOCATION = {
  facilityName: "Sportanlage Im Brüel",
  municipality: "Allschwil",
  measuredStation: METEOSWISS_STATION,
  forecastPointId: METEOSWISS_E4_POINT_ID,
} as const;

const getCachedCanonicalKioskWeather = unstable_cache(
  async (): Promise<WeatherResult> => fetchCurrentWeather(),
  ["infoboard-canonical-kiosk-weather"],
  {
    revalidate: CANONICAL_KIOSK_WEATHER_REVALIDATE_SECONDS,
    tags: [CANONICAL_KIOSK_WEATHER_CACHE_TAG],
  },
);

/**
 * Returns the canonical normalized weather payload for all Infoboard kiosks.
 * Callers on the same deployment share one cached result per revalidation window.
 */
export async function getCanonicalKioskWeather(): Promise<WeatherResult> {
  return getCachedCanonicalKioskWeather();
}
