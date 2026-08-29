/**
 * lib/events/__tests__/tenant-local-datetime.test.ts
 *
 * TOURNAMENT-TIMEZONE-01A — canonical tenant-local datetime round-trip tests.
 */

import { describe, expect, it } from "vitest";
import {
  parseTenantLocalDateTimeInput,
  resolveTenantEventTimezone,
  utcInstantToDateTimeLocalValue,
} from "@/lib/events/tenant-local-datetime";

const ZURICH = "Europe/Zurich";
const NEW_YORK = "America/New_York";

describe("resolveTenantEventTimezone", () => {
  it("falls back to Europe/Zurich when tenant timezone is unset", () => {
    expect(resolveTenantEventTimezone(null)).toBe("Europe/Zurich");
    expect(resolveTenantEventTimezone("")).toBe("Europe/Zurich");
  });

  it("uses the configured tenant timezone when present", () => {
    expect(resolveTenantEventTimezone("America/New_York")).toBe("America/New_York");
  });
});

describe("tenant-local datetime round-trip", () => {
  it("round-trips summer local start 13:30 as 13:30 (not 15:30)", () => {
    const localInput = "2026-08-30T13:30";
    const utc = parseTenantLocalDateTimeInput(localInput, ZURICH);

    expect(utc?.toISOString()).toBe("2026-08-30T11:30:00.000Z");
    expect(utcInstantToDateTimeLocalValue(utc, ZURICH)).toBe("2026-08-30T13:30");
  });

  it("round-trips winter local start 13:30 as 13:30 (CET, not hardcoded +2)", () => {
    const localInput = "2026-01-12T13:30";
    const utc = parseTenantLocalDateTimeInput(localInput, ZURICH);

    expect(utc?.toISOString()).toBe("2026-01-12T12:30:00.000Z");
    expect(utcInstantToDateTimeLocalValue(utc, ZURICH)).toBe("2026-01-12T13:30");
  });

  it("round-trips end time correctly in summer", () => {
    const localInput = "2026-08-30T15:00";
    const utc = parseTenantLocalDateTimeInput(localInput, ZURICH);

    expect(utc?.toISOString()).toBe("2026-08-30T13:00:00.000Z");
    expect(utcInstantToDateTimeLocalValue(utc, ZURICH)).toBe("2026-08-30T15:00");
  });

  it("round-trips Treffpunkt (meetingTime) correctly", () => {
    const localInput = "2026-08-30T12:45";
    const utc = parseTenantLocalDateTimeInput(localInput, ZURICH);

    expect(utc?.toISOString()).toBe("2026-08-30T10:45:00.000Z");
    expect(utcInstantToDateTimeLocalValue(utc, ZURICH)).toBe("2026-08-30T12:45");
  });

  it("parses absolute ISO instants without re-applying tenant offset", () => {
    const absolute = "2026-08-30T11:30:00.000Z";
    const parsed = parseTenantLocalDateTimeInput(absolute, ZURICH);

    expect(parsed?.toISOString()).toBe("2026-08-30T11:30:00.000Z");
    expect(utcInstantToDateTimeLocalValue(parsed, ZURICH)).toBe("2026-08-30T13:30");
  });

  it("supports a non-Europe tenant timezone", () => {
    const localInput = "2026-08-30T13:30";
    const utc = parseTenantLocalDateTimeInput(localInput, NEW_YORK);

    expect(utc?.toISOString()).toBe("2026-08-30T17:30:00.000Z");
    expect(utcInstantToDateTimeLocalValue(utc, NEW_YORK)).toBe("2026-08-30T13:30");
  });

  it("does not use iso.slice(0,16) semantics that mask UTC components as local", () => {
    const wronglyStoredUtc = "2026-08-30T13:30:00.000Z";
    const legacySlice = wronglyStoredUtc.slice(0, 16);
    const canonical = utcInstantToDateTimeLocalValue(wronglyStoredUtc, ZURICH);

    expect(legacySlice).toBe("2026-08-30T13:30");
    expect(canonical).toBe("2026-08-30T15:30");
    expect(canonical).not.toBe(legacySlice);
  });
});

describe("TournamentCenter display model", () => {
  function formatTournamentDate(value: string, locale: string, timezone: string): string {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  }

  it("shows 13:30 in TournamentCenter when canonical UTC is stored", () => {
    const dtoStartAt = parseTenantLocalDateTimeInput("2026-08-30T13:30", ZURICH)!.toISOString();
    const label = formatTournamentDate(dtoStartAt, "de-CH", ZURICH);

    expect(label).toContain("30.08.2026");
    expect(label).toMatch(/13:30/);
    expect(label).not.toMatch(/15:30/);
  });
});

describe("public API serialization contract", () => {
  it("preserves ISO UTC timestamp shape for website consumers", () => {
    const utc = parseTenantLocalDateTimeInput("2026-08-30T13:30", ZURICH)!;
    const publicItem = {
      id: "evt-1",
      startAt: utc,
      endAt: parseTenantLocalDateTimeInput("2026-08-30T15:00", ZURICH),
      meetingTime: null,
    };

    const serialized = JSON.parse(JSON.stringify(publicItem));

    expect(serialized.startAt).toBe("2026-08-30T11:30:00.000Z");
    expect(serialized.endAt).toBe("2026-08-30T13:00:00.000Z");
    expect(serialized.meetingTime).toBeNull();
  });

  it("website display of serialized startAt shows tenant-local 13:30", () => {
    const serializedStartAt = "2026-08-30T11:30:00.000Z";
    const websiteTime = new Intl.DateTimeFormat("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ZURICH,
    }).format(new Date(serializedStartAt));

    expect(websiteTime).toMatch(/13:30/);
    expect(websiteTime).not.toMatch(/15:30/);
  });
});
