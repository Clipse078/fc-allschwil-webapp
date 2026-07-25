/**
 * lib/weather/__tests__/weather-service.test.ts
 *
 * Tests for the provider-neutral weather service.
 *
 * Covers:
 *   C1.  MeteoSwiss is the active provider by default
 *   C2.  No Open-Meteo request occurs (no customer-api.open-meteo.com call)
 *   C3.  No WEATHER_API_KEY required for the active provider
 *   C4.  Returns WEATHER_UNAVAILABLE safely on failure
 *   C5.  Successful response returns isAvailable: true
 *   C6.  Network failure returns WEATHER_UNAVAILABLE (not an exception)
 */

import { describe, it, expect, vi } from "vitest";
import { fetchCurrentWeather } from "../weather-service";
import { WEATHER_UNAVAILABLE } from "../weather-types";

// ── VQHA80 fixture ────────────────────────────────────────────────────────────

const VQHA80_HEADER =
  "Station/Location;Date;tre200s0;rre150z0;sre000z0;gre000z0;ure200s0;tde200s0;dkl010z0;fu3010z0;fu3010z1;prestas0;pp0qffs0;pp0qnhs0;ppz850s0;ppz700s0;dv1towz0;fu3towz0;fu3towz1;ta1tows0;uretows0;tdetows0";

function makeFreshTimestamp(): string {
  const d = new Date(Date.now() - 5 * 60 * 1_000); // 5 minutes ago
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes())
  );
}

function makeMinimalVqha80(temp = "20.0", wind = "5.0"): string {
  const ts = makeFreshTimestamp();
  return (
    `${VQHA80_HEADER}\n` +
    `BAS;${ts};${temp};0.00;0.00;0.00;50.00;10.00;200.00;${wind};8.00;970.00;1006.00;1008.00;-;-;-;-;-;-;-;-\n`
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────
// ── C1. MeteoSwiss is the active provider ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — active provider is MeteoSwiss", () => {
  it("C1. calls the FSDI data.geo.admin.ch endpoint (MeteoSwiss VQHA80)", async () => {
    const csv = makeMinimalVqha80();
    const mockFetch = makeFetchText(csv);
    await fetchCurrentWeather(mockFetch);
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("data.geo.admin.ch");
    expect(calledUrl).toContain("VQHA80.csv");
  });

  it("C1. returns isAvailable: true from MeteoSwiss data", async () => {
    const csv = makeMinimalVqha80("22.3", "7.2");
    const result = await fetchCurrentWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── C2. No Open-Meteo request ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — no Open-Meteo call", () => {
  it("C2. does NOT call customer-api.open-meteo.com", async () => {
    const csv = makeMinimalVqha80();
    const mockFetch = makeFetchText(csv);
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("open-meteo.com");
  });

  it("C2. does NOT call api.open-meteo.com", async () => {
    const csv = makeMinimalVqha80();
    const mockFetch = makeFetchText(csv);
    await fetchCurrentWeather(mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toMatch(/api\.open-meteo\.com/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── C3. No API key required ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — no API key required", () => {
  it("C3. works without WEATHER_API_KEY env var", async () => {
    const saved = process.env["WEATHER_API_KEY"];
    delete process.env["WEATHER_API_KEY"];

    const csv = makeMinimalVqha80();
    const result = await fetchCurrentWeather(makeFetchText(csv));
    expect(result.isAvailable).toBe(true);

    if (saved !== undefined) process.env["WEATHER_API_KEY"] = saved;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── C4 & C6. Safe unavailable state ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe("fetchCurrentWeather — safe failure handling", () => {
  it("C4. returns WEATHER_UNAVAILABLE (not an exception) on network failure", async () => {
    const result = await fetchCurrentWeather(
      makeFetchError(new Error("network error")),
    );
    expect(result).toEqual(WEATHER_UNAVAILABLE);
  });

  it("C6. returns WEATHER_UNAVAILABLE on empty CSV body", async () => {
    const result = await fetchCurrentWeather(makeFetchText(""));
    expect(result).toEqual(WEATHER_UNAVAILABLE);
  });

  it("C4. facility data unaffected — service never throws", async () => {
    let threw = false;
    try {
      await fetchCurrentWeather(makeFetchError(new Error("test")));
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
