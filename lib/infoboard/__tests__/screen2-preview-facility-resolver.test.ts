/**
 * lib/infoboard/__tests__/screen2-preview-facility-resolver.test.ts
 *
 * Regression tests for Screen-2 preview facility resolution (INFOBOARD-SCREEN2-URGENT-02B).
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

const FCA_CANONICAL_PITCHES: PitchOccupancy[] = [
  makePitch({
    code: "HAUPTFELD",
    displayLabel: "Hauptfeld",
    resourceType: "FULL_PITCH",
    facilityId: "fac-hauptfeld",
    facilityName: "Hauptfeld",
  }),
  makePitch({
    code: "HAUPTFELD_A",
    displayLabel: "Hauptfeld A",
    resourceType: "HALF_PITCH",
    facilityId: "fac-hauptfeld",
    facilityName: "Hauptfeld",
  }),
  makePitch({
    code: "HAUPTFELD_B",
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
];

describe("resolveScreen2PreviewFacilities", () => {
  it("A — resolves FC Allschwil canonical HAUPTFELD dataset", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_CANONICAL_PITCHES);

    expect(resolved.hauptfeldFull.code).toBe("HAUPTFELD");
    expect(resolved.hauptfeldFull.resourceType).toBe("FULL_PITCH");
  });

  it("B — resolves Hauptfeld halves HAUPTFELD_A and HAUPTFELD_B", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_CANONICAL_PITCHES);

    expect(resolved.hauptfeldHalfA.code).toBe("HAUPTFELD_A");
    expect(resolved.hauptfeldHalfB.code).toBe("HAUPTFELD_B");
    expect(resolved.hauptfeldHalfA.facilityId).toBe(
      resolved.hauptfeldFull.facilityId,
    );
  });

  it("C — resolves Kunstrasen 2 and Kunstrasen 3 slots", () => {
    const resolved = resolveScreen2PreviewFacilities(FCA_CANONICAL_PITCHES);

    expect(resolved.kr2Full.code).toBe("KUNSTRASEN_2");
    expect(resolved.kr2HalfA.code).toBe("KUNSTRASEN_2_A");
    expect(resolved.kr2HalfB.code).toBe("KUNSTRASEN_2_B");
    expect(resolved.kr3Full.code).toBe("KUNSTRASEN_3");
    expect(resolved.kr3HalfA.code).toBe("KUNSTRASEN_3_A");
    expect(resolved.kr3HalfB.code).toBe("KUNSTRASEN_3_B");
  });

  it("D — ignores unrelated FULL_PITCH resources such as HALLE_1", () => {
    const pitches = [
      ...FCA_CANONICAL_PITCHES,
      makePitch({
        code: "HALLE_1",
        displayLabel: "Halle 1",
        resourceType: "FULL_PITCH",
        facilityId: "fac-halle-1",
      }),
      makePitch({
        code: "HALLE_2",
        displayLabel: "Halle 2",
        resourceType: "FULL_PITCH",
        facilityId: "fac-halle-2",
      }),
      makePitch({
        code: "HALLE_3",
        displayLabel: "Halle 3",
        resourceType: "FULL_PITCH",
        facilityId: "fac-halle-3",
      }),
    ];

    const resolved = resolveScreen2PreviewFacilities(pitches);
    expect(resolved.hauptfeldFull.code).toBe("HAUPTFELD");
  });

  it("E — fails deterministically when Hauptfeld FULL_PITCH is missing", () => {
    const pitches = FCA_CANONICAL_PITCHES.filter(
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

  it("F — falls back to legacy STADION when canonical HAUPTFELD is absent", () => {
    const legacyPitches = FCA_CANONICAL_PITCHES.map((pitch) => {
      if (pitch.code === "HAUPTFELD") {
        return makePitch({
          ...pitch,
          code: "STADION",
          displayLabel: "Stadion",
        });
      }
      if (pitch.code === "HAUPTFELD_A") {
        return makePitch({
          ...pitch,
          code: "STADION_A",
          displayLabel: "Stadion A",
        });
      }
      if (pitch.code === "HAUPTFELD_B") {
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

  it("G — rejects ambiguity when both HAUPTFELD and STADION are present", () => {
    const ambiguousPitches = [
      ...FCA_CANONICAL_PITCHES,
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
});
