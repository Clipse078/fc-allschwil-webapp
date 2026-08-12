/**
 * lib/facilities/__tests__/pitches-infoboard.test.ts
 *
 * Tests for infoboardLabel field added to FCA_PITCH_ALLOCATIONS.
 */

import { describe, it, expect } from "vitest";
import { FCA_PITCH_ALLOCATIONS, getPitchAllocationByCode } from "../pitches";

describe("PitchAllocationOption.infoboardLabel", () => {
  it("all allocations have an infoboardLabel", () => {
    for (const allocation of FCA_PITCH_ALLOCATIONS) {
      expect(allocation.infoboardLabel, `${allocation.code} missing infoboardLabel`).toBeTruthy();
    }
  });

  it("KUNSTRASEN_2_A infoboardLabel is 'KR 2 – Feld A'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_2_A");
    expect(alloc?.infoboardLabel).toBe("KR 2 – Feld A");
  });

  it("KUNSTRASEN_2_B infoboardLabel is 'KR 2 – Feld B'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_2_B");
    expect(alloc?.infoboardLabel).toBe("KR 2 – Feld B");
  });

  it("KUNSTRASEN_3_A infoboardLabel is 'KR 3 – Feld A'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_3_A");
    expect(alloc?.infoboardLabel).toBe("KR 3 – Feld A");
  });

  it("KUNSTRASEN_3_B infoboardLabel is 'KR 3 – Feld B'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_3_B");
    expect(alloc?.infoboardLabel).toBe("KR 3 – Feld B");
  });

  it("KUNSTRASEN_2 infoboardLabel is 'KR 2'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_2");
    expect(alloc?.infoboardLabel).toBe("KR 2");
  });

  it("KUNSTRASEN_3 infoboardLabel is 'KR 3'", () => {
    const alloc = getPitchAllocationByCode("KUNSTRASEN_3");
    expect(alloc?.infoboardLabel).toBe("KR 3");
  });

  it("STADION infoboardLabel is 'Stadion'", () => {
    const alloc = getPitchAllocationByCode("STADION");
    expect(alloc?.infoboardLabel).toBe("Stadion");
  });

  it("infoboardLabel does not expose raw code like KUNSTRASEN_2_A", () => {
    for (const alloc of FCA_PITCH_ALLOCATIONS) {
      // Should not contain underscores (raw code pattern)
      expect(alloc.infoboardLabel, `${alloc.code} infoboardLabel looks like a raw code`).not.toMatch(/_/);
    }
  });
});
