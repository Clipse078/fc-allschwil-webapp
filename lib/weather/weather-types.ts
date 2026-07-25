/**
 * lib/weather/weather-types.ts
 *
 * Provider-neutral weather DTO types for Infoboard Screen 2.
 *
 * These types decouple the weather adapter from any provider-specific
 * payload shape. Both the server-side adapter and the presentation
 * component import from this module.
 *
 * Design constraints:
 *   - No framework imports, no Prisma, no DB access, no I/O.
 *   - Pure type definitions and a single constant sentinel value.
 *   - All temperature values are in °C, all wind values in km/h.
 */

// ── Weather DTO ───────────────────────────────────────────────────────────────

/**
 * Current weather reading for a fixed facility location.
 *
 * All values are provider-neutral and use metric units.
 * German condition labels are assigned by the adapter.
 */
export type WeatherDto = {
  isAvailable: true;
  /** Current temperature in degrees Celsius (rounded to one decimal). */
  temperatureC: number;
  /** WMO weather interpretation code (0–99). */
  conditionCode: number;
  /** German condition label derived from conditionCode. */
  conditionLabel: string;
  /** Wind speed in km/h. */
  windKmh: number;
  /**
   * Precipitation probability 0–100, or null when the selected provider
   * does not include it in the current-conditions endpoint.
   */
  precipitationProbability: number | null;
  /** UTC ISO-8601 string for when this reading was observed. */
  observedAt: string;
};

/** Sentinel value used when weather data is unavailable or the provider failed. */
export type WeatherUnavailableDto = {
  isAvailable: false;
};

/** Union of all possible weather results. */
export type WeatherResult = WeatherDto | WeatherUnavailableDto;

/** Singleton sentinel for the unavailable case. */
export const WEATHER_UNAVAILABLE: WeatherUnavailableDto = { isAvailable: false };
