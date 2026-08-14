/**
 * lib/publishing/infoboard/__tests__/facility-group.test.ts
 *
 * Unit tests for the canonical facility hierarchy resolver.
 *
 * Facility hierarchy is a domain presentation invariant. These tests encode
 * the NON-NEGOTIABLE rules for FULL_PITCH / HALF_PITCH display:
 *
 *   State A — all free         → show ONLY FULL_PITCH (FREI). Never A/B.
 *   State B — FULL occupied    → show ONLY FULL_PITCH. Never A/B.
 *   State C — any HALF current → show HALF_PITCHes only. Suppress FULL.
 *   State D — all HALFs current→ show HALF_PITCHes only. Suppress FULL.
 *
 * The screenshot regression test at the end verifies the EXACT scenario seen
 * in the Aug 2026 screenshot that showed Hauptplatz + Hauptplatz A + Hauptplatz B
 * simultaneously — which is WRONG and must never happen again.
 *
 * If any change to Screen 2, Anlageplan, or related components causes any of
 * these tests to fail, the facility hierarchy has regressed and must be fixed
 * before merging.
 *
 * Grouping identity: facilityId (stable DB id) — NOT facilityName (display text).
 */

import { describe, it, expect } from "vitest";
import { groupFacilityPitches } from "../facility-group";
import type { PitchOccupancy, PitchEventSummary } from "../../event-types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<PitchEventSummary> = {}): PitchEventSummary {
  return {
    eventId: "evt-1",
    displayTitle: "Test Event",
    teamDisplayName: "Test Team",
    opponentDisplayName: null,
    startAt: "2026-08-14T18:00:00.000Z",
    endAt: "2026-08-14T20:00:00.000Z",
    status: "SCHEDULED",
    type: "MATCH",
    temporalRelation: "current",
    dressingRooms: [],
    ...overrides,
  };
}

function makePitch(overrides: Partial<PitchOccupancy>): PitchOccupancy {
  return {
    code: "PITCH-1",
    displayLabel: "Pitch 1",
    facilityName: "Teststadion",
    facilityId: "facility-01",
    resourceType: "FULL_PITCH",
    state: "FREE_NOW",
    currentEvent: null,
    nextEvent: null,
    hasAllocationConflict: false,
    ...overrides,
  };
}

// ── Empty / trivial cases ─────────────────────────────────────────────────────

describe("groupFacilityPitches — trivial cases", () => {
  it("returns empty when given empty list", () => {
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([]);
    expect(visiblePitches).toHaveLength(0);
    expect(suppressedCodes.size).toBe(0);
  });

  it("returns the single resource unchanged", () => {
    const pitch = makePitch({ code: "KR1", resourceType: "FULL_PITCH" });
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([pitch]);
    expect(visiblePitches).toHaveLength(1);
    expect(suppressedCodes.size).toBe(0);
  });

  it("returns multiple resources unchanged when no facility has FULL+HALF mix", () => {
    const p1 = makePitch({ code: "KR1", facilityId: "fac-1", resourceType: "FULL_PITCH" });
    const p2 = makePitch({ code: "KR2", facilityId: "fac-2", resourceType: "FULL_PITCH" });
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([p1, p2]);
    expect(visiblePitches).toHaveLength(2);
    expect(suppressedCodes.size).toBe(0);
  });
});

// ── State A — all free → show FULL_PITCH only ─────────────────────────────────

describe("groupFacilityPitches — State A: all resources free", () => {
  const FACILITY_ID = "hauptplatz-fac";

  const full = makePitch({
    code: "HP",
    displayLabel: "Hauptplatz",
    facilityId: FACILITY_ID,
    resourceType: "FULL_PITCH",
    state: "FREE_NOW",
  });
  const halfA = makePitch({
    code: "HP-A",
    displayLabel: "Hauptplatz A",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "FREE_NOW",
  });
  const halfB = makePitch({
    code: "HP-B",
    displayLabel: "Hauptplatz B",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "FREE_NOW",
  });

  it("shows exactly ONE resource card (the FULL_PITCH)", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches).toHaveLength(1);
    expect(visiblePitches[0].code).toBe("HP");
    expect(visiblePitches[0].resourceType).toBe("FULL_PITCH");
  });

  it("suppresses Hauptplatz A", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("HP-A")).toBe(true);
  });

  it("suppresses Hauptplatz B", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("HP-B")).toBe(true);
  });

  it("shows FULL_PITCH in FREI state", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches[0].state).toBe("FREE_NOW");
    expect(visiblePitches[0].currentEvent).toBeNull();
  });
});

// ── State B — FULL_PITCH has current event → show FULL_PITCH only ────────────

describe("groupFacilityPitches — State B: FULL_PITCH occupied", () => {
  const FACILITY_ID = "kr2-fac";
  const match = makeEvent({ type: "MATCH", teamDisplayName: "FC Allschwil Senioren 30+" });

  const full = makePitch({
    code: "KR2",
    displayLabel: "KR 2",
    facilityId: FACILITY_ID,
    resourceType: "FULL_PITCH",
    state: "OCCUPIED_NOW",
    currentEvent: { ...match, temporalRelation: "current" },
  });
  const halfA = makePitch({
    code: "KR2-A",
    displayLabel: "KR 2 – Feld A",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "FREE_NOW",
  });
  const halfB = makePitch({
    code: "KR2-B",
    displayLabel: "KR 2 – Feld B",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "FREE_NOW",
  });

  it("shows exactly ONE resource card (the FULL_PITCH with event)", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches).toHaveLength(1);
    expect(visiblePitches[0].code).toBe("KR2");
  });

  it("the FULL_PITCH card carries the match event", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches[0].currentEvent?.teamDisplayName).toBe("FC Allschwil Senioren 30+");
  });

  it("suppresses KR2-A even though it looks FREE_NOW", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("KR2-A")).toBe(true);
  });

  it("suppresses KR2-B even though it looks FREE_NOW", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("KR2-B")).toBe(true);
  });
});

// ── State C — one HALF has current event → show HALF_PITCHes, suppress FULL ──

describe("groupFacilityPitches — State C: one half occupied", () => {
  const FACILITY_ID = "kr3-fac";
  const training = makeEvent({ type: "TRAINING", teamDisplayName: "2. Mannschaft" });

  const full = makePitch({
    code: "KR3",
    displayLabel: "KR 3",
    facilityId: FACILITY_ID,
    resourceType: "FULL_PITCH",
    state: "FREE_NOW",
  });
  const halfA = makePitch({
    code: "KR3-A",
    displayLabel: "KR 3 – Feld A",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "OCCUPIED_NOW",
    currentEvent: { ...training, temporalRelation: "current" },
  });
  const halfB = makePitch({
    code: "KR3-B",
    displayLabel: "KR 3 – Feld B",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "FREE_NOW",
  });

  it("shows exactly TWO cards (both halves)", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches).toHaveLength(2);
    const codes = visiblePitches.map((p) => p.code);
    expect(codes).toContain("KR3-A");
    expect(codes).toContain("KR3-B");
  });

  it("suppresses the FULL_PITCH", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("KR3")).toBe(true);
  });

  it("does not suppress either half", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("KR3-A")).toBe(false);
    expect(suppressedCodes.has("KR3-B")).toBe(false);
  });
});

// ── State D — both halves occupied → show HALF_PITCHes, suppress FULL ────────

describe("groupFacilityPitches — State D: both halves occupied", () => {
  const FACILITY_ID = "kr3-fac-d";
  const ev1 = makeEvent({ eventId: "e1", type: "TRAINING", teamDisplayName: "Team A" });
  const ev2 = makeEvent({ eventId: "e2", type: "TRAINING", teamDisplayName: "Team B" });

  const full = makePitch({
    code: "KR3",
    facilityId: FACILITY_ID,
    resourceType: "FULL_PITCH",
    state: "FREE_NOW",
  });
  const halfA = makePitch({
    code: "KR3-A",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "OCCUPIED_NOW",
    currentEvent: { ...ev1, temporalRelation: "current" },
  });
  const halfB = makePitch({
    code: "KR3-B",
    facilityId: FACILITY_ID,
    resourceType: "HALF_PITCH",
    state: "OCCUPIED_NOW",
    currentEvent: { ...ev2, temporalRelation: "current" },
  });

  it("shows exactly TWO cards (both halves)", () => {
    const { visiblePitches } = groupFacilityPitches([full, halfA, halfB]);
    expect(visiblePitches).toHaveLength(2);
  });

  it("suppresses the FULL_PITCH", () => {
    const { suppressedCodes } = groupFacilityPitches([full, halfA, halfB]);
    expect(suppressedCodes.has("KR3")).toBe(true);
  });
});

// ── Multiple facilities — independent grouping ────────────────────────────────

describe("groupFacilityPitches — multiple facilities with different states", () => {
  // Exactly the screenshot scenario from Aug 14, 2026:
  //   Hauptplatz (fac-hp): FULL free + A free + B free → FULL_PITCH FREI only
  //   KR 2       (fac-kr2): FULL has match → FULL only, no KR2 A/B
  //   KR 3       (fac-kr3): A training + B training → A + B, no full KR3

  const hpFull = makePitch({ code: "HP", displayLabel: "Hauptplatz", facilityId: "fac-hp", resourceType: "FULL_PITCH", state: "FREE_NOW" });
  const hpA = makePitch({ code: "HP-A", displayLabel: "Hauptplatz A", facilityId: "fac-hp", resourceType: "HALF_PITCH", state: "FREE_NOW" });
  const hpB = makePitch({ code: "HP-B", displayLabel: "Hauptplatz B", facilityId: "fac-hp", resourceType: "HALF_PITCH", state: "FREE_NOW" });

  const kr2Match = makeEvent({ eventId: "m1", type: "MATCH", teamDisplayName: "FC Allschwil Senioren 30+", temporalRelation: "current" });
  const kr2Full = makePitch({ code: "KR2", displayLabel: "KR 2", facilityId: "fac-kr2", resourceType: "FULL_PITCH", state: "OCCUPIED_NOW", currentEvent: kr2Match });
  const kr2A = makePitch({ code: "KR2-A", displayLabel: "KR 2 – Feld A", facilityId: "fac-kr2", resourceType: "HALF_PITCH", state: "FREE_NOW" });
  const kr2B = makePitch({ code: "KR2-B", displayLabel: "KR 2 – Feld B", facilityId: "fac-kr2", resourceType: "HALF_PITCH", state: "FREE_NOW" });

  const trainA = makeEvent({ eventId: "t1", type: "TRAINING", teamDisplayName: "2. Mannschaft", temporalRelation: "current" });
  const trainB = makeEvent({ eventId: "t2", type: "TRAINING", teamDisplayName: "Junioren A", temporalRelation: "current" });
  const kr3Full = makePitch({ code: "KR3", displayLabel: "KR 3", facilityId: "fac-kr3", resourceType: "FULL_PITCH", state: "FREE_NOW" });
  const kr3A = makePitch({ code: "KR3-A", displayLabel: "KR 3 – Feld A", facilityId: "fac-kr3", resourceType: "HALF_PITCH", state: "OCCUPIED_NOW", currentEvent: trainA });
  const kr3B = makePitch({ code: "KR3-B", displayLabel: "KR 3 – Feld B", facilityId: "fac-kr3", resourceType: "HALF_PITCH", state: "OCCUPIED_NOW", currentEvent: trainB });

  const ALL_PITCHES = [hpFull, hpA, hpB, kr2Full, kr2A, kr2B, kr3Full, kr3A, kr3B];

  it("SCREENSHOT REGRESSION: returns exactly 4 visible resources total (HP, KR2, KR3-A, KR3-B)", () => {
    const { visiblePitches } = groupFacilityPitches(ALL_PITCHES);
    const codes = visiblePitches.map((p) => p.code).sort();
    expect(codes).toEqual(["HP", "KR2", "KR3-A", "KR3-B"]);
  });

  it("SCREENSHOT REGRESSION: Hauptplatz — exactly ONE card, FREI, code HP", () => {
    const { visiblePitches } = groupFacilityPitches(ALL_PITCHES);
    const hp = visiblePitches.filter((p) => p.facilityId === "fac-hp");
    expect(hp).toHaveLength(1);
    expect(hp[0].code).toBe("HP");
    expect(hp[0].currentEvent).toBeNull();
  });

  it("SCREENSHOT REGRESSION: Hauptplatz A is suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("HP-A")).toBe(true);
  });

  it("SCREENSHOT REGRESSION: Hauptplatz B is suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("HP-B")).toBe(true);
  });

  it("SCREENSHOT REGRESSION: KR2 — exactly ONE card with FC Allschwil Senioren 30+ match", () => {
    const { visiblePitches } = groupFacilityPitches(ALL_PITCHES);
    const kr2 = visiblePitches.filter((p) => p.facilityId === "fac-kr2");
    expect(kr2).toHaveLength(1);
    expect(kr2[0].code).toBe("KR2");
    expect(kr2[0].currentEvent?.teamDisplayName).toBe("FC Allschwil Senioren 30+");
  });

  it("SCREENSHOT REGRESSION: KR2-A is suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("KR2-A")).toBe(true);
  });

  it("SCREENSHOT REGRESSION: KR2-B is suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("KR2-B")).toBe(true);
  });

  it("SCREENSHOT REGRESSION: KR3 — exactly TWO cards (Feld A + Feld B)", () => {
    const { visiblePitches } = groupFacilityPitches(ALL_PITCHES);
    const kr3 = visiblePitches.filter((p) => p.facilityId === "fac-kr3");
    expect(kr3).toHaveLength(2);
    const codes = kr3.map((p) => p.code).sort();
    expect(codes).toEqual(["KR3-A", "KR3-B"]);
  });

  it("SCREENSHOT REGRESSION: full KR3 card is suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("KR3")).toBe(true);
  });

  it("SCREENSHOT REGRESSION: KR3-A and KR3-B are NOT suppressed", () => {
    const { suppressedCodes } = groupFacilityPitches(ALL_PITCHES);
    expect(suppressedCodes.has("KR3-A")).toBe(false);
    expect(suppressedCodes.has("KR3-B")).toBe(false);
  });
});

// ── Grouping uses facilityId, NOT facilityName ────────────────────────────────

describe("groupFacilityPitches — identity: facilityId, not facilityName", () => {
  it("treats same facilityName with DIFFERENT facilityIds as separate facilities", () => {
    // Two pitches that happen to have the same display name but different DB ids
    const p1 = makePitch({
      code: "A1",
      facilityName: "Shared Name",
      facilityId: "fac-001",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
    });
    const p2 = makePitch({
      code: "A2",
      facilityName: "Shared Name",
      facilityId: "fac-002",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
    });
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([p1, p2]);
    // No FULL+HALF mix in either group → both visible
    expect(visiblePitches).toHaveLength(2);
    expect(suppressedCodes.size).toBe(0);
  });

  it("treats different facilityNames with the SAME facilityId as one facility", () => {
    // A FULL_PITCH and HALF_PITCH in the same facility, facilityName differs by data error
    const full = makePitch({
      code: "KR1",
      facilityName: "Kunstrasen 1",
      facilityId: "fac-kr1",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
    });
    const half = makePitch({
      code: "KR1-A",
      facilityName: "Kunstrasen 1 (Hälfte)", // wrong name but same facilityId
      facilityId: "fac-kr1",
      resourceType: "HALF_PITCH",
      state: "FREE_NOW",
    });
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([full, half]);
    // State A: all free → show only FULL_PITCH
    expect(visiblePitches).toHaveLength(1);
    expect(visiblePitches[0].code).toBe("KR1");
    expect(suppressedCodes.has("KR1-A")).toBe(true);
  });
});

// ── Only HALF_PITCHes (no FULL_PITCH configured) ─────────────────────────────

describe("groupFacilityPitches — facility with only HALF_PITCHes", () => {
  it("returns all halves unchanged when no FULL_PITCH sibling exists", () => {
    const half1 = makePitch({ code: "H1", facilityId: "fac-x", resourceType: "HALF_PITCH" });
    const half2 = makePitch({ code: "H2", facilityId: "fac-x", resourceType: "HALF_PITCH" });
    const { visiblePitches, suppressedCodes } = groupFacilityPitches([half1, half2]);
    expect(visiblePitches).toHaveLength(2);
    expect(suppressedCodes.size).toBe(0);
  });
});
