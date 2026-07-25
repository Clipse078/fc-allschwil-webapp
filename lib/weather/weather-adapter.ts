/**
 * lib/weather/weather-adapter.ts
 *
 * Provider-neutral weather adapter — delegates to weather-service.ts.
 *
 * Active provider: MeteoSwiss Open Data (SwissMetNet VQHA80).
 *   – No API key or paid subscription required.
 *   – Attribution required: "Quelle: MeteoSwiss" (rendered in InfoboardScreen2).
 *   – Licence: Swiss OGD — unrestricted reuse with source citation.
 *
 * Dormant provider: Open-Meteo (commercial).
 *   – Cannot activate without WEATHER_API_KEY and an explicit change
 *     to the ACTIVE_PROVIDER constant in weather-service.ts.
 *   – Do not set WEATHER_API_KEY for FC Allschwil / MeteoSwiss deployment.
 *
 * This module re-exports the condition-label helper and the CONDITION_LABEL_UNKNOWN
 * sentinel from the Open-Meteo provider to preserve backward compatibility
 * with existing tests that import from this file.
 *
 * For new code, prefer importing directly from:
 *   – lib/weather/weather-service.ts     (fetchCurrentWeather)
 *   – lib/weather/weather-types.ts       (WeatherResult, WeatherDto, WEATHER_UNAVAILABLE)
 */

export {
  fetchCurrentWeather,
} from "./weather-service";

// Re-export Open-Meteo condition helpers so existing tests continue to compile.
export {
  getOpenMeteoConditionLabel as getConditionLabel,
  OPEN_METEO_CONDITION_LABEL_UNKNOWN as CONDITION_LABEL_UNKNOWN,
  parseOpenMeteoResponse,
  type FetchFn,
} from "./providers/open-meteo-weather-provider";
