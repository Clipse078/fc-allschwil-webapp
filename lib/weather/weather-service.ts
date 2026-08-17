/**
 * Canonical provider-neutral weather service for all Infoboards.
 *
 * MeteoSwiss-only architecture:
 *
 * 1. VQHA80 / BAS provides measured temperature, wind and timestamp.
 * 2. E4 local forecast / Allschwil enriches semantic weather condition.
 * 3. If E4 is unavailable or the symbol is unsupported, the existing
 *    VQHA80-derived condition remains unchanged.
 */

import {
  fetchMeteoSwissE4Condition,
} from "./providers/meteoswiss-e4-weather-provider";

import {
  fetchMeteoSwissWeather,
} from "./providers/meteoswiss-weather-provider";

import type {
  WeatherResult,
} from "./weather-types";

export async function fetchCurrentWeather(
  fetchFn?: unknown,
): Promise<WeatherResult> {
  const meteoswiss =
    await fetchMeteoSwissWeather(
      fetchFn as Parameters<
        typeof fetchMeteoSwissWeather
      >[0],
    );

  if (!meteoswiss.isAvailable) {
    return meteoswiss;
  }

  const e4 =
    await fetchMeteoSwissE4Condition(
      fetchFn as Parameters<
        typeof fetchMeteoSwissE4Condition
      >[0],
    );

  if (!e4.isAvailable) {
    return meteoswiss;
  }

  return {
    ...meteoswiss,
    conditionCode:
      e4.value.conditionCode,
    conditionLabel:
      e4.value.conditionLabel,
  };
}
