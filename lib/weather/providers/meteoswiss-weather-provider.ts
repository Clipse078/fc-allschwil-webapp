/**
 * lib/weather/providers/meteoswiss-weather-provider.ts
 *
 * Server-side weather provider — MeteoSwiss Open Data (SwissMetNet).
 *
 * ─── Data source ────────────────────────────────────────────────────────────
 * File:         VQHA80.csv
 * Description:  Current measurements for all ~160 SwissMetNet stations.
 *               Published as official Open Government Data (OGD).
 * URL:          https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv
 * Documentation:https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations
 * Update freq:  Every 10 minutes (file updated every 10 min at station level).
 * Format:       Semicolon-separated CSV, header row, UTC timestamps.
 * Size:         ≈5 KB (all stations, main parameters only).
 *
 * ─── Station selection ──────────────────────────────────────────────────────
 * Station:      BAS — Basel / Binningen
 * Station lat:  47.541142°N
 * Station lon:  7.583525°E
 * Station alt:  316 m MASL
 * Target:       Sportanlage Im Brüel, Allschwil, BL
 *               47.5519°N, 7.5351°E, ≈280 m MASL
 * Distance:     ≈3.8 km (Haversine)
 * Altitude Δ:   ≈36 m — negligible for facility weather display
 * Justification:BAS is the official MeteoSwiss SMN station closest to
 *               Allschwil with a full measurement programme (temperature,
 *               wind, precipitation, sunshine, pressure, humidity).
 *
 * ─── Licence ────────────────────────────────────────────────────────────────
 * Licence:      Swiss Open Government Data (OGD), unrestricted reuse.
 *               "The 'Open Data' from MeteoSwiss may be used without
 *               restriction; the source must be cited when reproducing
 *               or redistributing ('Source: MeteoSwiss')."
 *               Source: https://opendatadocs.meteoswiss.ch/
 * Commercial:   ✅ Permitted — no restriction on commercial SaaS use.
 * Attribution:  "Quelle: MeteoSwiss" must appear in the UI when data is shown.
 *
 * ─── Variables used ─────────────────────────────────────────────────────────
 * tre200s0:  Air temperature 2 m above ground, current value, °C
 * fu3010z0:  Wind speed 10-minute mean, km/h
 * rre150z0:  Precipitation 10-minute total, mm  (used for condition derivation)
 * sre000z0:  Sunshine duration 10-minute total, min (used for condition derivation)
 * Date:      Observation UTC timestamp, format yyyyMMddHHmm
 *
 * ─── Condition derivation ───────────────────────────────────────────────────
 * MeteoSwiss VQHA80 does NOT include a weather-condition code.
 * Condition is conservatively derived from measured precipitation and
 * sunshine duration (see deriveCondition()). The derivation is:
 *   – deterministic;
 *   – documented;
 *   – conservative (prefers neutral label when uncertain);
 *   – clearly identified as derived (not an official MeteoSwiss condition).
 * conditionCode is a synthetic WMO-like integer used only for icon selection.
 *
 * ─── Security ───────────────────────────────────────────────────────────────
 * – URL is hardcoded to data.geo.admin.ch (official Swiss FSDI infrastructure).
 * – No arbitrary configurable base URL; no SSRF risk.
 * – No authentication required, no secrets.
 * – No client-side request; provider payload never forwarded to the browser.
 * – 8-second timeout; response is plain text CSV (no archive, no XML, no shell).
 * – Response size is naturally bounded (≈5 KB).
 * – No path traversal; no temporary files.
 *
 * ─── Caching ────────────────────────────────────────────────────────────────
 * next.revalidate = 600 (10 min), matching VQHA80 update frequency.
 * Both infoboard screens share the same cached response via Next.js fetch cache.
 * A stale cached value is served on transient provider failure.
 *
 * ─── Stale-observation guard ────────────────────────────────────────────────
 * Observations older than STALE_THRESHOLD_MS (90 min) are rejected.
 * A missed update cycle or measurement gap returns WEATHER_UNAVAILABLE.
 *
 * ─── Design constraints ─────────────────────────────────────────────────────
 * – No Prisma, no DB, no Next.js imports, no React.
 * – No large external parsing library (CSV split is trivial and well-bounded).
 * – FetchFn is injected for testability; default is globalThis.fetch.
 * – Log messages never include URL, station values, or secrets.
 * – Only current conditions are served — no forecast data.
 */

import { WEATHER_UNAVAILABLE, type WeatherResult } from "../weather-types";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Official FSDI URL for the VQHA80 all-stations CSV.
 * Published by MeteoSwiss; hosted by swisstopo's Federal Spatial Data
 * Infrastructure (FSDI). No authentication required.
 * Documentation: https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations
 */
const VQHA80_URL =
  "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv";

/**
 * Station abbreviation for Basel / Binningen.
 * The nearest full SwissMetNet (SMN) station to Sportanlage Im Brüel,
 * Allschwil (≈3.8 km, ≈36 m altitude difference).
 */
export const METEOSWISS_STATION = "BAS";

/** Next.js fetch cache revalidation interval in seconds (10 minutes). */
export const REVALIDATE_SECONDS = 600;

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 8_000;

/**
 * Maximum age of an observation before it is considered stale.
 * 90 minutes = 9 expected update cycles, providing a buffer for
 * measurement gaps and infrastructure delays.
 */
export const STALE_THRESHOLD_MS = 90 * 60 * 1_000;

// ── VQHA80 CSV column indices ─────────────────────────────────────────────────

/**
 * VQHA80 CSV column layout (0-based, semicolon-separated).
 * Header: Station/Location;Date;tre200s0;rre150z0;sre000z0;gre000z0;
 *         ure200s0;tde200s0;dkl010z0;fu3010z0;fu3010z1;...
 *
 * Source: https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/info/VQHA80_en.txt
 */
const COL_STATION = 0;
const COL_DATE = 1;
const COL_TEMP = 2;   // tre200s0: Air temperature 2m °C (current value)
const COL_PRECIP = 3; // rre150z0: Precipitation mm (10-min total)
const COL_SUN = 4;    // sre000z0: Sunshine duration min (10-min total)
// COL 5: gre000z0 — global radiation W/m² (not used)
// COL 6: ure200s0 — relative humidity % (not used)
// COL 7: tde200s0 — dew point °C (not used)
// COL 8: dkl010z0 — wind direction ° (not used)
const COL_WIND = 9;   // fu3010z0: Wind speed km/h (10-min mean)

// ── Condition derivation ──────────────────────────────────────────────────────

/**
 * A MeteoSwiss-derived weather condition — NOT an official MeteoSwiss code.
 * Derived from measured precipitation (rre150z0) and sunshine (sre000z0).
 */
export type DerivedCondition = {
  /** German condition label (derived, not official MeteoSwiss condition). */
  readonly label: string;
  /**
   * Synthetic WMO-like code for icon selection only.
   * These are reasonable WMO analogues; they are NOT reported by MeteoSwiss.
   */
  readonly syntheticCode: number;
};

/**
 * Derives a weather condition from measured precipitation and sunshine.
 *
 * Rules (applied in order):
 *   1. rre150z0 > 0.1 mm in the 10-min window → "Regen" (rain detected).
 *   2. sre000z0 >= 8 min (≥80% sunshine in window) → "Sonnig".
 *   3. sre000z0 >= 2 min (≥20% sunshine) → "Heiter" (partly sunny).
 *   4. Otherwise → "Aktuelle Messwerte" (neutral; covers night, overcast,
 *      and cases where no reliable inference can be made).
 *
 * Limitations:
 *   – At night, sunshine is always 0; rule 4 applies and shows the neutral label.
 *   – "Bewölkt" (overcast) cannot be reliably distinguished from night without
 *     cloud-cover data, which is absent from VQHA80.
 *   – This derivation intentionally favours accuracy over completeness.
 *
 * @param precipMm  rre150z0 value in mm (10-min total precipitation).
 * @param sunMin    sre000z0 value in minutes (10-min sunshine duration total).
 */
export function deriveCondition(
  precipMm: number,
  sunMin: number,
): DerivedCondition {
  if (precipMm > 0.1) {
    return { label: "Regen", syntheticCode: 61 };
  }
  if (sunMin >= 8.0) {
    return { label: "Sonnig", syntheticCode: 0 };
  }
  if (sunMin >= 2.0) {
    return { label: "Heiter", syntheticCode: 2 };
  }
  return { label: "Aktuelle Messwerte", syntheticCode: 3 };
}

// ── Timestamp parsing ─────────────────────────────────────────────────────────

/**
 * Parses a VQHA80 UTC timestamp string (yyyyMMddHHmm) into an ISO-8601 string.
 * Returns null when the input is not a valid 12-digit numeric string.
 *
 * Example: "202607251400" → "2026-07-25T14:00:00.000Z"
 */
export function parseVqha80Timestamp(raw: string): string | null {
  if (!/^\d{12}$/.test(raw)) return null;
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(8, 10);
  const minute = raw.slice(10, 12);
  const candidate = `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
  const d = new Date(candidate);
  if (isNaN(d.getTime())) return null;
  return candidate;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

/**
 * Parses a numeric field from a VQHA80 CSV row.
 * Returns null when the value is missing, "-", or not a finite number.
 */
function parseField(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "" || value.trim() === "-") {
    return null;
  }
  const n = parseFloat(value.trim());
  return isFinite(n) ? n : null;
}

/**
 * Finds the BAS (or configured station) row in the VQHA80 CSV text and
 * parses it into a WeatherResult.
 *
 * The CSV is semicolon-separated with a single header row.
 * Missing values are represented as "-".
 *
 * Exported for unit testing without network calls.
 *
 * @param csvText  Full text of the VQHA80 CSV file.
 * @param station  Station abbreviation to search for (default: "BAS").
 * @param nowMs    Current time in milliseconds since epoch (for stale check).
 */
export function parseVqha80Csv(
  csvText: string,
  station: string = METEOSWISS_STATION,
  nowMs: number = Date.now(),
): WeatherResult {
  const lines = csvText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split(";");
    if (cols[COL_STATION]?.trim() !== station) continue;

    // Station row found.
    const rawDate = cols[COL_DATE]?.trim() ?? "";
    const rawTemp = cols[COL_TEMP];
    const rawPrecip = cols[COL_PRECIP];
    const rawSun = cols[COL_SUN];
    const rawWind = cols[COL_WIND];

    const temperatureC = parseField(rawTemp);
    const windKmh = parseField(rawWind);

    if (temperatureC === null || windKmh === null) {
      console.error(
        `[meteoswiss] Station ${station}: required fields (temp or wind) missing or invalid`,
      );
      return WEATHER_UNAVAILABLE;
    }

    const observedAt = parseVqha80Timestamp(rawDate);
    if (observedAt === null) {
      console.error(
        `[meteoswiss] Station ${station}: unparseable timestamp "${rawDate}"`,
      );
      return WEATHER_UNAVAILABLE;
    }

    // Stale-observation guard.
    const observedMs = new Date(observedAt).getTime();
    const ageMs = nowMs - observedMs;
    if (ageMs > STALE_THRESHOLD_MS) {
      console.error(
        `[meteoswiss] Station ${station}: observation is stale (age ${Math.round(ageMs / 60_000)} min)`,
      );
      return WEATHER_UNAVAILABLE;
    }

    const precipMm = parseField(rawPrecip) ?? 0;
    const sunMin = parseField(rawSun) ?? 0;
    const { label: conditionLabel, syntheticCode: conditionCode } =
      deriveCondition(precipMm, sunMin);

    return {
      isAvailable: true,
      temperatureC: Math.round(temperatureC * 10) / 10,
      conditionCode,
      conditionLabel,
      windKmh: Math.round(windKmh * 10) / 10,
      precipitationProbability: null,
      observedAt,
    };
  }

  // Station not found in file.
  console.error(`[meteoswiss] Station ${station} not found in VQHA80 data`);
  return WEATHER_UNAVAILABLE;
}

// ── FetchFn type ──────────────────────────────────────────────────────────────

export type FetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

// ── fetchMeteoSwissWeather ────────────────────────────────────────────────────

/**
 * Fetches current weather from the MeteoSwiss VQHA80 all-stations CSV.
 *
 * Returns WEATHER_UNAVAILABLE on any failure:
 *   – Network error or timeout.
 *   – Non-2xx HTTP response.
 *   – Malformed or missing station data.
 *   – Stale observation (>90 min old).
 *   – Missing required numeric fields.
 *
 * No secrets are required. No external configuration required.
 *
 * @param fetchFn - Injected fetch function (default: globalThis.fetch).
 *   Supply a mock in tests to avoid network calls.
 */
export async function fetchMeteoSwissWeather(
  fetchFn: FetchFn = globalThis.fetch as unknown as FetchFn,
): Promise<WeatherResult> {
  let response: { ok: boolean; status: number; text: () => Promise<string> };

  try {
    response = await fetchFn(VQHA80_URL, {
      // Next.js fetch cache: reuse cached response for 10 minutes.
      // This matches the VQHA80 update frequency.
      // Both infoboard screens share the same cached download.
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    } as RequestInit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[meteoswiss] Network or timeout error:", message);
    return WEATHER_UNAVAILABLE;
  }

  if (!response.ok) {
    console.error(
      `[meteoswiss] Provider returned non-2xx status: ${response.status}`,
    );
    return WEATHER_UNAVAILABLE;
  }

  let csvText: string;
  try {
    csvText = await response.text();
  } catch {
    console.error("[meteoswiss] Failed to read response body");
    return WEATHER_UNAVAILABLE;
  }

  return parseVqha80Csv(csvText);
}
