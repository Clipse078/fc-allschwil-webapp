/**
 * lib/integrations/sfv/sync/__tests__/provider-time.test.ts
 *
 * Regression tests for the SFV kickoff-time hotfix (SFV-MATCH-SYNC-HOTFIX-01).
 *
 * Proven root cause: the SFV API returns matchDate as an offset-less string
 * representing Europe/Zurich CIVIL (wall-clock) time, not UTC. The previous
 * code (`new Date(entry.matchDate)` / manually appending "Z") silently
 * treated it as UTC, producing a systematic error equal to whatever the
 * Europe/Zurich UTC offset happens to be (+2h in summer/CEST, +1h in
 * winter/CET) — never a fixed +2h.
 *
 * Known real fixture (live SFV API verification, 2026-08-07):
 *   ClubId=483 (FC Allschwil), matchId=4346477
 *   raw matchDate: "2026-08-07T20:30:00"
 *   FC Allschwil vs SC Basel Nord Weiss — Senioren 30+ Promotion
 *   SFV Matchcenter displays kickoff as 20:30.
 *   → Must resolve to 20:30 Europe/Zurich (18:30 UTC, CEST = UTC+2) — not
 *     18:30 (correct) misrendered as 22:30 (the reported bug).
 */

import { describe, it, expect } from "vitest";
import { parseSfvMatchDateTime, SFV_PROVIDER_TIME_ZONE } from "../provider-time";

function formatInZurich(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Zurich",
  }).format(date);
}

describe("parseSfvMatchDateTime", () => {
  it("exposes the provider time zone constant as Europe/Zurich", () => {
    expect(SFV_PROVIDER_TIME_ZONE).toBe("Europe/Zurich");
  });

  it("known fixture: SFV 07.08.2026 20:30 (summer/CEST) → 20:30 Europe/Zurich everywhere", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00");

    // Correct UTC instant: 07.08.2026 is CEST (UTC+2) → 18:30 UTC.
    expect(result.toISOString()).toBe("2026-08-07T18:30:00.000Z");

    // Rendered back in Europe/Zurich, it must read 20:30 — not 22:30.
    expect(formatInZurich(result)).toBe("20:30");
  });

  it("known fixture must NOT reproduce the reported +2h bug (22:30)", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00");
    expect(formatInZurich(result)).not.toBe("22:30");
  });

  it("winter fixture (CET, UTC+1): 15.01.2026 18:00 → 18:00 Europe/Zurich, 17:00 UTC", () => {
    const result = parseSfvMatchDateTime("2026-01-15T18:00:00");

    expect(result.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(formatInZurich(result)).toBe("18:00");
  });

  it("winter fixture is not a hardcoded UTC+2 adjustment (would wrongly read 20:00)", () => {
    const result = parseSfvMatchDateTime("2026-01-15T18:00:00");
    expect(formatInZurich(result)).not.toBe("20:00");
    expect(formatInZurich(result)).toBe("18:00");
  });

  it("handles the DST spring-forward boundary correctly (CET → CEST, 29.03.2026)", () => {
    // 2026-03-29 is the EU spring-forward date: 02:00 CET → 03:00 CEST.
    // A kickoff shortly before the transition is still CET (+1).
    const beforeTransition = parseSfvMatchDateTime("2026-03-29T01:30:00");
    expect(beforeTransition.toISOString()).toBe("2026-03-29T00:30:00.000Z");

    // A kickoff after the transition is already CEST (+2).
    const afterTransition = parseSfvMatchDateTime("2026-03-29T10:00:00");
    expect(afterTransition.toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("handles the DST fall-back boundary correctly (CEST → CET, 25.10.2026)", () => {
    // 2026-10-25 is the EU fall-back date: 03:00 CEST → 02:00 CET.
    // A kickoff shortly before the transition is still CEST (+2).
    const beforeTransition = parseSfvMatchDateTime("2026-10-25T01:30:00");
    expect(beforeTransition.toISOString()).toBe("2026-10-24T23:30:00.000Z");

    // A kickoff well after the transition is already CET (+1).
    const afterTransition = parseSfvMatchDateTime("2026-10-25T18:00:00");
    expect(afterTransition.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("preserves seconds precision", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:45");
    expect(result.toISOString()).toBe("2026-08-07T18:30:45.000Z");
  });

  it("defaults seconds to 0 when omitted", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30");
    expect(result.toISOString()).toBe("2026-08-07T18:30:00.000Z");
  });

  it("trusts an explicit 'Z' suffix as-is (never reinterpreted)", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00Z");
    expect(result.toISOString()).toBe("2026-08-07T20:30:00.000Z");
  });

  it("trusts an explicit '+02:00' offset as-is (never reinterpreted)", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00+02:00");
    expect(result.toISOString()).toBe("2026-08-07T18:30:00.000Z");
  });

  it("trusts an explicit '+00:00' offset as-is (never reinterpreted)", () => {
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00+00:00");
    expect(result.toISOString()).toBe("2026-08-07T20:30:00.000Z");
  });

  it("is independent of the process/runtime time zone (deterministic result)", () => {
    // No matter what TZ the Node process is running under, the parsed
    // instant must be identical — this is the exact bug: the old code's
    // result depended on process.env-level runtime TZ (UTC on Vercel).
    const result = parseSfvMatchDateTime("2026-08-07T20:30:00");
    expect(result.getTime()).toBe(Date.UTC(2026, 7, 7, 18, 30, 0));
  });

  it("accepts a custom IANA time zone override", () => {
    // Sanity check that the zone parameter is honored (not hardcoded).
    const zurich = parseSfvMatchDateTime("2026-08-07T20:30:00", "Europe/Zurich");
    const london = parseSfvMatchDateTime("2026-08-07T20:30:00", "Europe/London");
    expect(zurich.getTime()).not.toBe(london.getTime());
    // London is BST (UTC+1) in August → one hour later in UTC terms than Zurich (UTC+2).
    expect(london.getTime() - zurich.getTime()).toBe(60 * 60 * 1000);
  });
});
