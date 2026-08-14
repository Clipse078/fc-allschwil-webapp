/**
 * lib/publishing/infoboard/__tests__/facility-group.test.ts
 *
 * INFOBOARD-UX-03 — unit tests for the full-pitch / subdivision deduplication
 * logic (groupFacilityPitches).
 *
 * Covers the canonical display rules A–E:
 *   1. Whole pitch free + all children free → one FULL_PITCH card
 *   2. Whole-pitch event → one FULL_PITCH card (subdivisions suppressed)
 *   3. Feld A + Feld B independently occupied → subdivision group
 *   4. One subdivision occupied + one free → subdivision group (mixed)
 *   5. No hierarchy (no FULL_PITCH partner) → each resource independently
 */

import { describe, it, expect } from "vitest";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import type { PitchOccupancy, PitchEventSummary } from "@/lib/publishing/event-types";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makePitch(
  overrides: Partial<PitchOccupancy> & { code: string; facilityId: string; resourceType: "FULL_PITCH" | "HALF_PITCH" }
): PitchOccupancy {
  return {
    displayLabel: overrides.code,
    facilityName: "Hauptanlage",
    state: "FREE_NOW",
    currentEvent: null,
    nextEvent: null,
    hasAllocationConflict: false,
    ...overrides,
  };
}

function makeSampleEvent(eventId: string): PitchEventSummary {
  return {
    eventId,
    displayTitle: "Test Training",
    teamDisplayName: "Test Team",
    opponentDisplayName: null,
    startAt: "2026-09-12T16:00:00.000Z",
    endAt: "2026-09-12T18:00:00.000Z",
    status: "SCHEDULED",
    type: "TRAINING",
    temporalRelation: "current",
    dressingRooms: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("groupFacilityPitches — Rule A: whole pitch free", () => {
  it("shows ONLY the FULL_PITCH when it and all HALF_PITCHes are free", () => {
    const pitches = [
      makePitch({ code: "HAUPTPLATZ", facilityId: "fac-1", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "FELD_A", facilityId: "fac-1", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "FELD_B", facilityId: "fac-1", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("whole");
    if (groups[0].mode === "whole") {
      expect(groups[0].pitch.code).toBe("HAUPTPLATZ");
      expect(groups[0].pitch.resourceType).toBe("FULL_PITCH");
    }
  });

  it("shows only the FULL_PITCH (as FREI) — does NOT show Feld A and Feld B separately", () => {
    const pitches = [
      makePitch({ code: "HP", facilityId: "fac-x", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "A", facilityId: "fac-x", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "B", facilityId: "fac-x", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    const codes = groups.flatMap((g) =>
      g.mode === "whole"
        ? [g.pitch.code]
        : g.mode === "subdivisions"
          ? g.items.map((i) => i.code)
          : [],
    );
    expect(codes).not.toContain("A");
    expect(codes).not.toContain("B");
    expect(codes).toContain("HP");
  });
});

describe("groupFacilityPitches — Rule B: whole-pitch event", () => {
  it("shows ONLY the FULL_PITCH when it has a current event", () => {
    const pitches = [
      makePitch({
        code: "HAUPTPLATZ",
        facilityId: "fac-2",
        resourceType: "FULL_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-1"),
      }),
      makePitch({ code: "FELD_A", facilityId: "fac-2", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "FELD_B", facilityId: "fac-2", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("whole");
    if (groups[0].mode === "whole") {
      expect(groups[0].pitch.code).toBe("HAUPTPLATZ");
    }
  });

  it("shows ONLY the FULL_PITCH when it has a next event (UPCOMING state)", () => {
    const pitches = [
      makePitch({
        code: "HP",
        facilityId: "fac-2b",
        resourceType: "FULL_PITCH",
        state: "UPCOMING",
        nextEvent: makeSampleEvent("evt-2"),
      }),
      makePitch({ code: "A", facilityId: "fac-2b", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("whole");
    if (groups[0].mode === "whole") {
      expect(groups[0].pitch.code).toBe("HP");
    }
  });
});

describe("groupFacilityPitches — Rule C: subdivisions independently occupied", () => {
  it("shows subdivision group when both HALF_PITCHes are occupied", () => {
    const pitches = [
      makePitch({ code: "HP", facilityId: "fac-3", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({
        code: "FELD_A",
        facilityId: "fac-3",
        resourceType: "HALF_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-a"),
      }),
      makePitch({
        code: "FELD_B",
        facilityId: "fac-3",
        resourceType: "HALF_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-b"),
      }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("subdivisions");
    if (groups[0].mode === "subdivisions") {
      expect(groups[0].items).toHaveLength(2);
      const codes = groups[0].items.map((i) => i.code);
      expect(codes).toContain("FELD_A");
      expect(codes).toContain("FELD_B");
    }
  });

  it("does NOT show a misleading FULL_PITCH FREI card alongside occupied sub-fields", () => {
    const pitches = [
      makePitch({ code: "HP", facilityId: "fac-3b", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({
        code: "A",
        facilityId: "fac-3b",
        resourceType: "HALF_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-a2"),
      }),
    ];

    const groups = groupFacilityPitches(pitches);

    const wholeGroups = groups.filter((g) => g.mode === "whole");
    expect(wholeGroups.map((g) => g.mode === "whole" && g.pitch.code)).not.toContain("HP");
  });
});

describe("groupFacilityPitches — Rule D: mixed partial state", () => {
  it("shows subdivisions when one HALF_PITCH is occupied and one is free", () => {
    const pitches = [
      makePitch({ code: "HP", facilityId: "fac-4", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({
        code: "FELD_A",
        facilityId: "fac-4",
        resourceType: "HALF_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-a3"),
      }),
      makePitch({ code: "FELD_B", facilityId: "fac-4", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("subdivisions");
    if (groups[0].mode === "subdivisions") {
      // Both Feld A (occupied) and Feld B (free) must be shown
      const codes = groups[0].items.map((i) => i.code);
      expect(codes).toContain("FELD_A");
      expect(codes).toContain("FELD_B");
    }
  });
});

describe("groupFacilityPitches — Rule E: hierarchy-driven, no hardcoding", () => {
  it("works for arbitrary resource codes, not just Hauptplatz/Feld A/Feld B", () => {
    const pitches = [
      makePitch({ code: "KUNSTRASEN_2", facilityId: "fac-kr2", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({
        code: "KUNSTRASEN_2_A",
        facilityId: "fac-kr2",
        resourceType: "HALF_PITCH",
        state: "OCCUPIED_NOW",
        currentEvent: makeSampleEvent("evt-kr2a"),
      }),
      makePitch({ code: "KUNSTRASEN_2_B", facilityId: "fac-kr2", resourceType: "HALF_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(1);
    expect(groups[0].mode).toBe("subdivisions");
    if (groups[0].mode === "subdivisions") {
      const codes = groups[0].items.map((i) => i.code);
      expect(codes).toContain("KUNSTRASEN_2_A");
      expect(codes).toContain("KUNSTRASEN_2_B");
    }
  });

  it("independent facilities are each treated separately", () => {
    const pitches = [
      makePitch({ code: "PLATZ1", facilityId: "fac-a", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "PLATZ2", facilityId: "fac-b", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(2);
    expect(groups[0].mode).toBe("whole");
    expect(groups[1].mode).toBe("whole");
  });

  it("preserves the original ordering of facilities across groups", () => {
    const pitches = [
      makePitch({ code: "FAC_B_FULL", facilityId: "fac-b", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "FAC_A_FULL", facilityId: "fac-a", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(2);
    if (groups[0].mode === "whole" && groups[1].mode === "whole") {
      expect(groups[0].pitch.code).toBe("FAC_B_FULL");
      expect(groups[1].pitch.code).toBe("FAC_A_FULL");
    }
  });
});

describe("groupFacilityPitches — no hierarchy (only FULL_PITCH, no HALF_PITCH)", () => {
  it("shows each FULL_PITCH independently when no HALF_PITCH siblings exist", () => {
    const pitches = [
      makePitch({ code: "KR1", facilityId: "fac-kr1", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "KR2", facilityId: "fac-kr2", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
      makePitch({ code: "KR3", facilityId: "fac-kr3", resourceType: "FULL_PITCH", state: "FREE_NOW" }),
    ];

    const groups = groupFacilityPitches(pitches);

    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.mode === "whole")).toBe(true);
  });
});

describe("groupFacilityPitches — empty input", () => {
  it("returns empty array for empty input", () => {
    expect(groupFacilityPitches([])).toEqual([]);
  });
});
