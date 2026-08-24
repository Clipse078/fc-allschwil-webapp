/**
 * lib/infoboard/__tests__/screen2-preview-facility-resolver.test.ts
 *
 * Regression tests for Screen-2 preview facility resolution (INFOBOARD-SCREEN2-URGENT-04).
 */

import { describe, it, expect } from "vitest";
import { resolveScreen2PreviewFacilities } from "../screen2-preview-facility-resolver";
import type { PitchOccupancy } from "@/lib/publishing/event-types";

function makePitch(
  overrides: Partial<PitchOccupancy> & Pick<PitchOccupancy, "code" | "resourceType">,
): PitchOccupancy {
  return {
    displayLabel: overrides.displayLabel ?? overrides.code,
    facilityName: overrides.facilityName ?? "Sportanlage",
    facilityId: overrides.facilityId ?? "facility-1",
    state: "FREE_NOW",
    hasAllocationConflict: false,
    currentEvent: null,
    nextEvent: null,
    currentEvents: [],
    ...overrides,
  };
}

/** Exact runtime evidence from FC Allschwil Screen-2 preview (space-separated Hauptfeld halves). */
const FCA_RUNTIME_PITCHES: PitchOccupancy[] = [
  makePitch({
    code: "HAUPTFELD",
    displayLabel: "Hauptfeld",
    resourceType: "FULL_PITCH",
    facilityId: "fac-hauptfeld",
    facilityName: "Hauptfeld",
  }),
  makePitch({
    code: "HAUPTFELD A",
    displayLabel: "Hauptfeld A",
    resourceType: "HALF_PITCH",
    facilityId: "fac-hauptfeld",
    facilityName: "Hauptfeld",
  }),
  makePitch({
    code: "HAUPTFELD B",
    displayLabel: "Hauptfeld B",
    resourceType: "HALF_PITCH",
    facilityId: "fac-hauptfeld",
    facilityName: "Hauptfeld",
  }),
  makePitch({
    code: "KUNSTRASEN_2",
    displayLabel: "Kunstrasen 2",
    resourceType: "FULL_PITCH",
    facilityId: "fac-kr2",
    facilityName: "Kunstrasen 2",
  }),
  makePitch({
    code: "KUNSTRASEN_2_A",
    displayLabel: "Kunstrasen 2 A",
    resourceType: "HALF_PITCH",
    facilityId: "fac-kr2",
    facilityName: "Kunstrasen 2",
  }),
  makePitch({
    code: "KUNSTRASEN_2_B",
    displayLabel: "Kunstrasen 2 B",
    resourceType: "HALF_PITCH",
    facilityId: "fac-kr2",
    facilityName: "Kunstrasen 2",
  }),
  makePitch({
    code: "KUNSTRASEN_3",
    displayLabel: "Kunstrasen 3",
    resourceType: "FULL_PITCH",
    facilityId: "fac-kr3",
    facilityName: "Kunstrasen 3",
  }),
  makePitch({
    code: "KUNSTRASEN_3_A",
    displayLabel: "Kunstrasen 3 A",
    resourceType: "HALF_PITCH",
    facilityId: "fac-kr3",
    facilityName: "Kunstrasen 3",
  }),
  makePitch({
    code: "KUNSTRASEN_3_B",
    displayLabel: "Kunstrasen 3 B",
    resourceType: "HALF_PITCH",
    facilityId: "fac-kr3",
    facilityName: "Kunstrasen 3",
  }),
  makePitch({
    code: "HALLE_1",
    displayLabel: "Halle 1",
    resourceType: "FULL_PITCH",
    facilityId: "fac-halle-1",
    facilityName: "Halle 1",
  }),
  makePitch({
    code: "HALLE_2",
    displayLabel: "Halle 2",
    resourceType: "FULL_PITCH",
    facilityId: "fac-halle-2",
    facilityName: "Halle 2",
  }),
  makePitch({
    code: "HALLE_3",
    displayLabel: "Halle 3",
    resourceType: "FULL_PITCH",
    facilityId: "fac-halle-3",
    facilityName: "Halle 3",
  }),
  makePitch({
    code: "FELD_C_TEST",
    displayLabel: "Feld C Test",
    resourceType: "HALF_PITCH",
    facilityId: "fac-feld-c-test",
    facilityName: "Feld C Test",
  }),
];

const FCA_UNDERSCORE_PITCHES: PitchOccupancy[] = FCA_RUNTIME_PITCHES.map(
  (pitch) => {
    if (pitch.code === "HAUPTFELD A") {
      return makePitch({ ...pitch, code: "HAUPTFELD_A" });
    }
    if (pitch.code === "HAUPTFELD B") {
      return makePitch({ ...pitch, code: "HAUPTFELD_B" });
    }
    return pitch;
  },
);

describe("resolveScreen2PreviewFacilities", () => {
  it("A — resolves HAUPTFELD FULL_PITCH", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_RUNTIME_PITCHES);

    expect(resolved.hauptfeldFull.code).toBe("HAUPTFELD");
    expect(resolved.hauptfeldFull.resourceType).toBe("FULL_PITCH");
  });

  it("B — resolves actual runtime code HAUPTFELD A as Hauptfeld A", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_RUNTIME_PITCHES);

    expect(resolved.hauptfeldHalfA.code).toBe("HAUPTFELD A");
    expect(resolved.hauptfeldHalfA.resourceType).toBe("HALF_PITCH");
    expect(resolved.hauptfeldHalfA.facilityId).toBe(
      resolved.hauptfeldFull.facilityId,
    );
  });

  it("C — resolves actual runtime code HAUPTFELD B as Hauptfeld B", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_RUNTIME_PITCHES);

    expect(resolved.hauptfeldHalfB.code).toBe("HAUPTFELD B");
    expect(resolved.hauptfeldHalfB.resourceType).toBe("HALF_PITCH");
  });

  it("D — resolves underscore-compatible HAUPTFELD_A and HAUPTFELD_B", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_UNDERSCORE_PITCHES);

    expect(resolved.hauptfeldHalfA.code).toBe("HAUPTFELD_A");
    expect(resolved.hauptfeldHalfB.code).toBe("HAUPTFELD_B");
  });

  it("E — falls back to legacy STADION when canonical Hauptfeld resources are absent", () => {
    const legacyPitches = FCA_RUNTIME_PITCHES.map((pitch) => {
      if (pitch.code === "HAUPTFELD") {
        return makePitch({
          ...pitch,
          code: "STADION",
          displayLabel: "Stadion",
        });
      }
      if (pitch.code === "HAUPTFELD A") {
        return makePitch({
          ...pitch,
          code: "STADION_A",
          displayLabel: "Stadion A",
        });
      }
      if (pitch.code === "HAUPTFELD B") {
        return makePitch({
          ...pitch,
          code: "STADION_B",
          displayLabel: "Stadion B",
        });
      }
      return pitch;
    });

    const resolved = resolveScreen2PreviewFacilities(legacyPitches);
    expect(resolved.hauptfeldFull.code).toBe("STADION");
    expect(resolved.hauptfeldHalfA.code).toBe("STADION_A");
    expect(resolved.hauptfeldHalfB.code).toBe("STADION_B");
  });

  it("F — HALLE_1/2/3 and FELD_C_TEST cannot resolve Hauptfeld slots", () => {
    const unrelatedOnly = FCA_RUNTIME_PITCHES.filter(
      (pitch) =>
        !pitch.code.startsWith("HAUPTFELD") && !pitch.code.startsWith("STADION"),
    );

    expect(() => resolveScreen2PreviewFacilities(unrelatedOnly)).toThrow(
      /expected exactly one Hauptfeld FULL_PITCH; found 0/,
    );
    expect(() => resolveScreen2PreviewFacilities(unrelatedOnly)).toThrow(
      /Expected canonical code\(s\): HAUPTFELD/,
    );

    const withHalleButNoHauptfeld = unrelatedOnly.concat(
      makePitch({
        code: "HALLE_1",
        displayLabel: "Halle 1",
        resourceType: "FULL_PITCH",
        facilityId: "fac-halle-1",
      }),
    );
    expect(() => resolveScreen2PreviewFacilities(withHalleButNoHauptfeld)).toThrow(
      /expected exactly one Hauptfeld FULL_PITCH; found 0/,
    );
  });

  it("G — rejects duplicate canonical Hauptfeld half-pitch candidates", () => {
    const ambiguousPitches = [
      ...FCA_RUNTIME_PITCHES,
      makePitch({
        code: "HAUPTFELD_A",
        displayLabel: "Hauptfeld A (underscore duplicate)",
        resourceType: "HALF_PITCH",
        facilityId: "fac-hauptfeld-dup",
      }),
    ];

    expect(() => resolveScreen2PreviewFacilities(ambiguousPitches)).toThrow(
      /expected exactly one Hauptfeld Feld A; found 2 canonical matches/,
    );
  });

  it("resolves all nine Screen-2 slots from exact FC Allschwil runtime fixture", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_RUNTIME_PITCHES);

    expect(resolved.hauptfeldFull.code).toBe("HAUPTFELD");
    expect(resolved.hauptfeldHalfA.code).toBe("HAUPTFELD A");
    expect(resolved.hauptfeldHalfB.code).toBe("HAUPTFELD B");
    expect(resolved.kr2Full.code).toBe("KUNSTRASEN_2");
    expect(resolved.kr2HalfA.code).toBe("KUNSTRASEN_2_A");
    expect(resolved.kr2HalfB.code).toBe("KUNSTRASEN_2_B");
    expect(resolved.kr3Full.code).toBe("KUNSTRASEN_3");
    expect(resolved.kr3HalfA.code).toBe("KUNSTRASEN_3_A");
    expect(resolved.kr3HalfB.code).toBe("KUNSTRASEN_3_B");
  });

  it("rejects ambiguity when both HAUPTFELD and STADION are present", () => {
    const ambiguousPitches = [
      ...FCA_RUNTIME_PITCHES,
      makePitch({
        code: "STADION",
        displayLabel: "Stadion",
        resourceType: "FULL_PITCH",
        facilityId: "fac-legacy-stadion",
      }),
    ];

    expect(() => resolveScreen2PreviewFacilities(ambiguousPitches)).toThrow(
      /ambiguous Hauptfeld FULL_PITCH/,
    );
    expect(() => resolveScreen2PreviewFacilities(ambiguousPitches)).toThrow(
      /canonical \(HAUPTFELD\) and legacy \(STADION\)/,
    );
  });

  it("fails deterministically when Hauptfeld FULL_PITCH is missing", () => {
    const pitches = FCA_RUNTIME_PITCHES.filter(
      (pitch) => pitch.code !== "HAUPTFELD",
    );

    expect(() => resolveScreen2PreviewFacilities(pitches)).toThrow(
      /expected exactly one Hauptfeld FULL_PITCH; found 0/,
    );
    expect(() => resolveScreen2PreviewFacilities(pitches)).toThrow(
      /Expected canonical code\(s\): HAUPTFELD/,
    );
    expect(() => resolveScreen2PreviewFacilities(pitches)).toThrow(
      /legacy fallback: STADION/,
    );
  });
});
