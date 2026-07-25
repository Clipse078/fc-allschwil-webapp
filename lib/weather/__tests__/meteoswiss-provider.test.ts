/**
 * lib/weather/__tests__/meteoswiss-provider.test.ts
 *
 * Unit tests for the MeteoSwiss Open Data weather provider.
 *
 * All external HTTP requests are mocked — no live API calls are made.
 * Fixtures are derived from the documented VQHA80 CSV schema.
 *
 * Source: https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations
 * VQHA80 info: https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/info/VQHA80_en.txt
 *
 * Covers:
 *   A1.  Successful response → isAvailable: true
 *   A2.  Temperature mapped from tre200s0 in °C (rounded to 1 decimal)
 *   A3.  Wind speed mapped from fu3010z0 in km/h (rounded to 1 decimal)
 *   A4.  Observation timestamp from Date field (yyyyMMddHHmm UTC → ISO-8601)
 *   A5.  Station BAS selected by default
 *   A6.  Malformed payload → WEATHER_UNAVAILABLE
 *   A7.  Timeout / network error → WEATHER_UNAVAILABLE
 *   A8.  Non-2xx response → WEATHER_UNAVAILABLE
 *   A9.  Stale observation (>90 min) → WEATHER_UNAVAILABLE
 *  A10.  Missing required fields (temp or wind as "-") → WEATHER_UNAVAILABLE
 *  A11.  Station not found in CSV → WEATHER_UNAVAILABLE
 *  A12.  Invalid timestamp format → WEATHER_UNAVAILABLE
 *  A13.  Empty CSV body → WEATHER_UNAVAILABLE
 *  A14.  Cache config: next.revalidate = 600 (10 min) passed to fetch
 *  A15.  No authentication required (no env var check)
 */

import { describe, it, expect, vi } from "vitest";
import {
  fetchMeteoSwissWeather,
  parseVqha80Csv,
  parseVqha80Timestamp,
  deriveCondition,
  METEOSWISS_STATION,
  REVALIDATE_SECONDS,
  STALE_THRESHOLD_MS,
} from "../providers/meteoswiss-weather-provider";
import { WEATHER_UNAVAILABLE } from "../weather-types";

// ── VQHA80 CSV fixture ────────────────────────────────────────────────────────

/**
 * Canonical VQHA80 CSV header line.
 * Source: https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/info/VQHA80_en.txt
 */
const VQHA80_HEADER =
  "Station/Location;Date;tre200s0;rre150z0;sre000z0;gre000z0;ure200s0;tde200s0;dkl010z0;fu3010z0;fu3010z1;prestas0;pp0qffs0;pp0qnhs0;ppz850s0;ppz700s0;dv1towz0;fu3towz0;fu3towz1;ta1tows0;uretows0;tdetows0";

/**
 * Builds a VQHA80 CSV with a BAS row using supplied values.
 * All other station data is minimal to keep fixtures small.
 */
function makeVqha80(overrides: {
  station?: string;
  date?: string;
  temp?: string;
  precip?: string;
  sun?: string;
  wind?: string;
} = {}): string {
  const {
    station = "BAS",
    date = makeTimestamp(),
    temp = "24.2",
    precip = "0.00",
    sun = "0.00",
    wind = "3.6",
  } = overrides;

  // Other columns filled with "-" to match real file structure.
  const row = `${station};${date};${temp};${precip};${sun};0.00;45.00;11.50;244.00;${wind};6.80;970.90;1006.60;1008.30;-;-;-;-;-;-;-;-`;
  return `${VQHA80_HEADER}\nTAE;202607251400;19.00;0.00;0.00;0.00;60.00;10.00;180.00;5.00;8.00;-;-;-;-;-;-;-;-;-;-;-\n${row}\n`;
}

/**
 * Generates a VQHA80 timestamp string (yyyyMMddHHmm, UTC) for a given
 * millisecond offset from the current time. Negative offsets = past.
 * Default: 5 minutes ago (well within the 90-minute staleness threshold).
 */
function makeTimestamp(offsetMs = -5 * 60 * 1_000): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes())
  );
}

const CURRENT_DATE = makeTimestamp();
const CURRENT_MS = Date.now();

// ── Fetch mocks ───────────────────────────────────────────────────────────────

function makeFetchText(body: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  });
}

function makeFetchError(err: Error) {
  return vi.fn().mockRejectedValue(err);
}

function makeFetchStatus(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.reject(new Error("should not be called")),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ── A1–A3. Successful response ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — successful response", () => {
  it("A1. returns isAvailable: true for a valid VQHA80 CSV", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);
  });

  it("A2. maps tre200s0 to temperatureC (°C, rounded to 1 decimal)", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE, temp: "22.55" });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.temperatureC).toBe(22.6);
    }
  });

  it("A2. temperature of 24.2 passes through correctly", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE, temp: "24.2" });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    if (result.isAvailable) {
      expect(result.temperatureC).toBe(24.2);
    }
  });

  it("A3. maps fu3010z0 to windKmh (km/h, rounded to 1 decimal)", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE, wind: "3.6" });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    if (result.isAvailable) {
      expect(result.windKmh).toBe(3.6);
    }
  });

  it("A3. fractional wind is rounded to 1 decimal", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE, wind: "12.35" });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    if (result.isAvailable) {
      expect(result.windKmh).toBe(12.4);
    }
  });

  it("precipitationProbability is null (not available in VQHA80)", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    if (result.isAvailable) {
      expect(result.precipitationProbability).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A4. Observation timestamp ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — observation timestamp", () => {
  it("A4. parseVqha80Timestamp correctly maps yyyyMMddHHmm to ISO-8601", () => {
    // Use the direct parser to test a specific known mapping.
    expect(parseVqha80Timestamp("202607251400")).toBe("2026-07-25T14:00:00.000Z");
    expect(parseVqha80Timestamp("202607250000")).toBe("2026-07-25T00:00:00.000Z");
  });

  it("A4. observedAt from fetchMeteoSwissWeather is a valid ISO-8601 UTC string", async () => {
    const ts = makeTimestamp();
    const csv = makeVqha80({ date: ts });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    }
  });

  it("A4. observedAt can be parsed back to a Date", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    if (result.isAvailable) {
      expect(() => new Date(result.observedAt)).not.toThrow();
      expect(isNaN(new Date(result.observedAt).getTime())).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A5. Station selection ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("MeteoSwiss — station selection", () => {
  it("A5. METEOSWISS_STATION is 'BAS' (Basel/Binningen)", () => {
    expect(METEOSWISS_STATION).toBe("BAS");
  });

  it("A5. selects station BAS by default from multi-station CSV", async () => {
    const csv =
      `${VQHA80_HEADER}\n` +
      `TAE;${CURRENT_DATE};19.00;0.00;0.00;0.00;60.00;10.00;180.00;5.00;8.00;-;-;-;-;-;-;-;-;-;-;-\n` +
      `BAS;${CURRENT_DATE};24.20;0.00;0.00;0.00;45.00;11.50;244.00;3.60;6.80;-;-;-;-;-;-;-;-;-;-;-\n` +
      `COM;${CURRENT_DATE};17.40;0.00;0.00;1.00;90.00;15.70;335.00;5.80;11.20;-;-;-;-;-;-;-;-;-;-;-\n`;
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);
    if (result.isAvailable) {
      expect(result.temperatureC).toBe(24.2);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A6. Malformed payload ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — malformed payload", () => {
  it("A6. returns WEATHER_UNAVAILABLE for empty CSV text", async () => {
    const result = await fetchMeteoSwissWeather(makeFetchText(""));
    expect(result.isAvailable).toBe(false);
  });

  it("A6. returns WEATHER_UNAVAILABLE for completely wrong format", async () => {
    const result = await fetchMeteoSwissWeather(makeFetchText("<html>Error</html>"));
    expect(result.isAvailable).toBe(false);
  });

  it("A6. returns WEATHER_UNAVAILABLE when text() throws", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.reject(new Error("body read error")),
    });
    const result = await fetchMeteoSwissWeather(mockFetch);
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A7. Timeout / network error ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — network / timeout", () => {
  it("A7. returns WEATHER_UNAVAILABLE on network error", async () => {
    const result = await fetchMeteoSwissWeather(
      makeFetchError(new Error("fetch failed")),
    );
    expect(result.isAvailable).toBe(false);
  });

  it("A7. returns WEATHER_UNAVAILABLE on AbortError (timeout)", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    const result = await fetchMeteoSwissWeather(
      makeFetchError(abortError as unknown as Error),
    );
    expect(result.isAvailable).toBe(false);
  });

  it("A7. no fake weather on failure", async () => {
    const result = await fetchMeteoSwissWeather(
      makeFetchError(new Error("network error")),
    );
    expect(result.isAvailable).toBe(false);
    expect((result as Record<string, unknown>)["temperatureC"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A8. Non-2xx response ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — non-2xx response", () => {
  it("A8. returns WEATHER_UNAVAILABLE on 500", async () => {
    const result = await fetchMeteoSwissWeather(makeFetchStatus(500));
    expect(result.isAvailable).toBe(false);
  });

  it("A8. returns WEATHER_UNAVAILABLE on 404", async () => {
    const result = await fetchMeteoSwissWeather(makeFetchStatus(404));
    expect(result.isAvailable).toBe(false);
  });

  it("A8. returns WEATHER_UNAVAILABLE on 429", async () => {
    const result = await fetchMeteoSwissWeather(makeFetchStatus(429));
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A9. Stale observation ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseVqha80Csv — stale observation", () => {
  it("A9. rejects observations older than STALE_THRESHOLD_MS", () => {
    // nowMs = arbitrary fixed point in time; stale = 91 min before nowMs.
    const nowMs = new Date("2026-07-25T15:00:00.000Z").getTime();
    // 91 minutes before 15:00 = 13:29
    const staleDate = "202607251329";
    const csv = makeVqha80({ date: staleDate });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(false);
  });

  it("A9. accepts observations within staleness threshold (60 min ago)", () => {
    const nowMs = new Date("2026-07-25T15:00:00.000Z").getTime();
    // 60 minutes before 15:00 = 14:00 (within 90 min threshold)
    const freshDate = "202607251400";
    const csv = makeVqha80({ date: freshDate });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(true);
  });

  it("STALE_THRESHOLD_MS is 90 minutes", () => {
    expect(STALE_THRESHOLD_MS).toBe(90 * 60 * 1_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A10. Missing required fields ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseVqha80Csv — missing required fields", () => {
  it("A10. returns WEATHER_UNAVAILABLE when temperature is '-'", () => {
    const ts = makeTimestamp();
    const nowMs = Date.now();
    const csv = makeVqha80({ date: ts, temp: "-" });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(false);
  });

  it("A10. returns WEATHER_UNAVAILABLE when wind is '-'", () => {
    const ts = makeTimestamp();
    const nowMs = Date.now();
    const csv = makeVqha80({ date: ts, wind: "-" });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(false);
  });

  it("A10. treats precipitation '-' as 0 (optional field)", () => {
    const ts = makeTimestamp();
    const nowMs = Date.now();
    const csv = makeVqha80({ date: ts, precip: "-" });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    // Missing precip is not fatal — default to 0 for condition derivation.
    expect(result.isAvailable).toBe(true);
  });

  it("A10. treats sunshine '-' as 0 (optional field)", () => {
    const ts = makeTimestamp();
    const nowMs = Date.now();
    const csv = makeVqha80({ date: ts, sun: "-" });
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A11. Station not found ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseVqha80Csv — station not found", () => {
  it("A11. returns WEATHER_UNAVAILABLE when BAS row is absent", () => {
    const ts = makeTimestamp();
    const nowMs = Date.now();
    const csv =
      `${VQHA80_HEADER}\n` +
      `TAE;${ts};19.00;0.00;0.00;0.00;60.00;10.00;180.00;5.00;8.00;-;-;-;-;-;-;-;-;-;-;-\n`;
    const result = parseVqha80Csv(csv, "BAS", nowMs);
    expect(result.isAvailable).toBe(false);
  });

  it("A11. returns WEATHER_UNAVAILABLE for header-only CSV", () => {
    const result = parseVqha80Csv(VQHA80_HEADER, "BAS", Date.now());
    expect(result.isAvailable).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A12. Invalid timestamp ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("parseVqha80Timestamp", () => {
  it("A12. returns null for non-numeric string", () => {
    expect(parseVqha80Timestamp("invalid")).toBeNull();
  });

  it("A12. returns null for wrong length", () => {
    expect(parseVqha80Timestamp("202607251")).toBeNull();
  });

  it("A12. returns null for empty string", () => {
    expect(parseVqha80Timestamp("")).toBeNull();
  });

  it("returns ISO string for valid 12-digit UTC timestamp", () => {
    expect(parseVqha80Timestamp("202607251400")).toBe("2026-07-25T14:00:00.000Z");
  });

  it("returns ISO string for midnight", () => {
    expect(parseVqha80Timestamp("202607250000")).toBe("2026-07-25T00:00:00.000Z");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A14. Cache configuration ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — cache configuration", () => {
  it("A14. REVALIDATE_SECONDS is 600 (10 minutes, matching VQHA80 update freq)", () => {
    expect(REVALIDATE_SECONDS).toBe(600);
  });

  it("A14. passes next.revalidate = 600 in fetch options", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const mockFetch = makeFetchText(csv);
    await fetchMeteoSwissWeather(mockFetch);
    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(fetchOptions?.next?.revalidate).toBe(600);
  });

  it("A14. requests the official FSDI VQHA80 URL", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const mockFetch = makeFetchText(csv);
    await fetchMeteoSwissWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("data.geo.admin.ch");
    expect(calledUrl).toContain("VQHA80.csv");
  });

  it("A14. does NOT request api.open-meteo.com or customer-api.open-meteo.com", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const mockFetch = makeFetchText(csv);
    await fetchMeteoSwissWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("open-meteo.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── A15. No authentication required ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchMeteoSwissWeather — no authentication required", () => {
  it("A15. succeeds without any env vars set", async () => {
    const savedKey = process.env["WEATHER_API_KEY"];
    delete process.env["WEATHER_API_KEY"];

    const csv = makeVqha80({ date: CURRENT_DATE });
    const result = await fetchMeteoSwissWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);

    if (savedKey !== undefined) {
      process.env["WEATHER_API_KEY"] = savedKey;
    }
  });

  it("A15. URL contains no API key or secret", async () => {
    const csv = makeVqha80({ date: CURRENT_DATE });
    const mockFetch = makeFetchText(csv);
    await fetchMeteoSwissWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("apikey=");
    expect(calledUrl).not.toContain("key=");
  });
});
