/**
 * lib/seasons/__tests__/season-logic.test.ts
 *
 * Regression tests for the canonical Swiss football season boundary.
 * Season transition: July 1 starts the new season.
 *   - June 30 → still the season ending in that calendar year.
 *   - July  1 → new season beginning in that calendar year.
 */

import { describe, it, expect } from "vitest";
import {
  getSwissFootballSeasonStartYearFromDate,
  getSwissFootballSeasonFromDate,
  getCurrentSwissFootballSeason,
} from "@/lib/seasons/season-logic";

// ── getSwissFootballSeasonStartYearFromDate ───────────────────────────────────

describe("getSwissFootballSeasonStartYearFromDate", () => {
  it("2026-06-30T23:59:59.999Z → startYear 2025 (last moment of previous season)", () => {
    expect(getSwissFootballSeasonStartYearFromDate("2026-06-30T23:59:59.999Z")).toBe(2025);
  });

  it("2026-07-01T00:00:00.000Z → startYear 2026 (first moment of new season)", () => {
    expect(getSwissFootballSeasonStartYearFromDate("2026-07-01T00:00:00.000Z")).toBe(2026);
  });

  it("2026-07-01T00:00:00.000Z (Date object) → startYear 2026", () => {
    expect(getSwissFootballSeasonStartYearFromDate(new Date("2026-07-01T00:00:00.000Z"))).toBe(2026);
  });

  it("2026-06-30T00:00:00.000Z → startYear 2025", () => {
    expect(getSwissFootballSeasonStartYearFromDate("2026-06-30T00:00:00.000Z")).toBe(2025);
  });

  it("mid-season date (2026-10-15) → startYear 2026", () => {
    expect(getSwissFootballSeasonStartYearFromDate("2026-10-15T00:00:00.000Z")).toBe(2026);
  });

  it("January date (2027-01-01) → startYear 2026 (mid-season)", () => {
    expect(getSwissFootballSeasonStartYearFromDate("2027-01-01T00:00:00.000Z")).toBe(2026);
  });
});

// ── getSwissFootballSeasonFromDate ────────────────────────────────────────────

describe("getSwissFootballSeasonFromDate", () => {
  it("2026-06-30T23:59:59.999Z → label 2025/2026", () => {
    const season = getSwissFootballSeasonFromDate("2026-06-30T23:59:59.999Z");
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2025/2026");
    expect(season!.startYear).toBe(2025);
    expect(season!.endYear).toBe(2026);
  });

  it("2026-07-01T00:00:00.000Z → label 2026/2027", () => {
    const season = getSwissFootballSeasonFromDate("2026-07-01T00:00:00.000Z");
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2026/2027");
    expect(season!.startYear).toBe(2026);
    expect(season!.endYear).toBe(2027);
  });
});

// ── getCurrentSwissFootballSeason (injected date) ─────────────────────────────

describe("getCurrentSwissFootballSeason", () => {
  it("injected 2026-06-30T23:59:59.999Z → label 2025/2026", () => {
    const season = getCurrentSwissFootballSeason("2026-06-30T23:59:59.999Z");
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2025/2026");
  });

  it("injected 2026-07-01T00:00:00.000Z → label 2026/2027", () => {
    const season = getCurrentSwissFootballSeason("2026-07-01T00:00:00.000Z");
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2026/2027");
  });

  it("injected Date object 2026-06-30 → label 2025/2026", () => {
    const season = getCurrentSwissFootballSeason(new Date("2026-06-30T23:59:59.999Z"));
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2025/2026");
  });

  it("injected Date object 2026-07-01 → label 2026/2027", () => {
    const season = getCurrentSwissFootballSeason(new Date("2026-07-01T00:00:00.000Z"));
    expect(season).not.toBeNull();
    expect(season!.label).toBe("2026/2027");
  });

  it("returns a non-null season for default (wall-clock) now", () => {
    expect(getCurrentSwissFootballSeason()).not.toBeNull();
  });
});
