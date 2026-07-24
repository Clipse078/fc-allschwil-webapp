/**
 * lib/publishing/presentation/__tests__/allocation-display-resolver.test.ts
 *
 * Unit tests for the allocation display resolvers.
 *
 * Coverage:
 *   - Generic allocation (resolveAllocationLabel)
 *     - label wins over code and name
 *     - code wins over name
 *     - blank code falls through to name
 *     - all absent returns null
 *     - whitespace trimming and internal whitespace preservation
 *     - capitalization preservation
 *     - input immutability
 *   - Pitch display (resolvePitchDisplay)
 *     - resource label returned without facility concatenation
 *     - code returned exactly
 *     - resource name used when code absent
 *     - facility name used only when all resource fields are absent
 *     - all absent returns null
 *     - no prefix automatically added
 *   - Dressing-room display (resolveDressingRoomDisplay)
 *     - code returned
 *     - name fallback returned
 *     - no translated prefix added
 *     - all absent returns null
 *     - input immutability
 *   - Allocation list (resolveAllocationList)
 *     - empty array returns null
 *     - one resolved item
 *     - multiple items use " · " separator
 *     - unresolved items omitted
 *     - order preserved
 *     - exact duplicates removed by default
 *     - different capitalization retained as distinct
 *     - deduplicate=false retains duplicates
 *     - custom separator respected
 *     - explicit empty separator respected
 *     - source array not mutated
 *     - source objects not mutated
 *     - options object not mutated
 *
 * No mocks required: all functions under test are pure.
 */

import { describe, it, expect } from "vitest";
import {
  resolveAllocationLabel,
  resolvePitchDisplay,
  resolveDressingRoomDisplay,
  resolveAllocationList,
} from "../allocation-display-resolver";
import type {
  AllocationResourceInput,
  PitchDisplayInput,
  DressingRoomDisplayInput,
  ResolveAllocationListOptions,
} from "../allocation-display-resolver";

// ── resolveAllocationLabel ────────────────────────────────────────────────────

describe("resolveAllocationLabel", () => {
  it("returns label when available (priority 1 over code and name)", () => {
    expect(
      resolveAllocationLabel({ label: "Kunstrasen 2", code: "KR2", name: "Full Kunstrasen 2" }),
    ).toBe("Kunstrasen 2");
  });

  it("returns code when label is absent (priority 2)", () => {
    expect(
      resolveAllocationLabel({ code: "KR2", name: "Kunstrasen 2" }),
    ).toBe("KR2");
  });

  it("returns code when label is blank", () => {
    expect(
      resolveAllocationLabel({ label: "", code: "KR2", name: "Kunstrasen 2" }),
    ).toBe("KR2");
  });

  it("returns code when label is whitespace-only", () => {
    expect(
      resolveAllocationLabel({ label: "  ", code: "G1", name: "Garderobe 1" }),
    ).toBe("G1");
  });

  it("falls through to name when code is blank", () => {
    expect(
      resolveAllocationLabel({ code: "", name: "Kunstrasen 2" }),
    ).toBe("Kunstrasen 2");
  });

  it("falls through to name when code is whitespace-only", () => {
    expect(
      resolveAllocationLabel({ code: "  ", name: "Kunstrasen 2" }),
    ).toBe("Kunstrasen 2");
  });

  it("falls through to name when code is null", () => {
    expect(
      resolveAllocationLabel({ code: null, name: "Kunstrasen 2" }),
    ).toBe("Kunstrasen 2");
  });

  it("returns null when all candidates are absent", () => {
    expect(resolveAllocationLabel({ label: null, code: null, name: null })).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveAllocationLabel({})).toBeNull();
  });

  it("trims surrounding whitespace from code", () => {
    expect(resolveAllocationLabel({ code: "  KR2  " })).toBe("KR2");
  });

  it("preserves internal whitespace in name", () => {
    expect(resolveAllocationLabel({ name: "Kunstrasen  2  A" })).toBe("Kunstrasen  2  A");
  });

  it("preserves capitalization", () => {
    expect(resolveAllocationLabel({ code: "kR2" })).toBe("kR2");
  });

  it("does not mutate the input object", () => {
    const input: AllocationResourceInput = Object.freeze({
      label: "Kunstrasen 2",
      code: "KR2",
      name: "Full Name",
    });
    resolveAllocationLabel(input);
    expect(input.label).toBe("Kunstrasen 2");
    expect(input.code).toBe("KR2");
    expect(input.name).toBe("Full Name");
  });
});

// ── resolvePitchDisplay ───────────────────────────────────────────────────────

describe("resolvePitchDisplay", () => {
  it("returns resource label without facility name concatenation", () => {
    const result = resolvePitchDisplay({
      label: "Kunstrasen 2",
      facilityName: "Im Brüel",
    });
    expect(result).toBe("Kunstrasen 2");
    expect(result).not.toContain("Im Brüel");
  });

  it("returns code exactly without modification", () => {
    expect(resolvePitchDisplay({ code: "KR2", facilityName: "Im Brüel" })).toBe("KR2");
  });

  it("returns resource name when code is absent", () => {
    expect(
      resolvePitchDisplay({ code: null, name: "Kunstrasen 2", facilityName: "Im Brüel" }),
    ).toBe("Kunstrasen 2");
  });

  it("uses facilityName only when all resource-level fields are absent", () => {
    expect(
      resolvePitchDisplay({ label: null, code: null, name: null, facilityName: "Im Brüel" }),
    ).toBe("Im Brüel");
  });

  it("uses facilityName when code is blank and name is absent", () => {
    expect(
      resolvePitchDisplay({ code: "", facilityName: "Im Brüel" }),
    ).toBe("Im Brüel");
  });

  it("does not concatenate facility and resource label", () => {
    const result = resolvePitchDisplay({ name: "Kunstrasen 2", facilityName: "Im Brüel" });
    expect(result).toBe("Kunstrasen 2");
    expect(result).not.toContain("Im Brüel");
  });

  it("returns null when all values are absent", () => {
    expect(
      resolvePitchDisplay({ label: null, code: null, name: null, facilityName: null }),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolvePitchDisplay({})).toBeNull();
  });

  it("does not add a pitch prefix to code", () => {
    const result = resolvePitchDisplay({ code: "KR2" });
    expect(result).toBe("KR2");
    expect(result).not.toMatch(/^(Pitch|Platz|Feld|Terrain)/i);
  });

  it("does not add a pitch prefix to name", () => {
    const result = resolvePitchDisplay({ name: "Kunstrasen 2" });
    expect(result).toBe("Kunstrasen 2");
    expect(result).not.toMatch(/^(Pitch|Platz|Feld|Terrain)/i);
  });

  it("does not add a pitch prefix to facilityName fallback", () => {
    const result = resolvePitchDisplay({ facilityName: "Im Brüel" });
    expect(result).toBe("Im Brüel");
    expect(result).not.toMatch(/^(Pitch|Platz|Feld|Terrain)/i);
  });

  it("trims facilityName", () => {
    expect(resolvePitchDisplay({ facilityName: "  Im Brüel  " })).toBe("Im Brüel");
  });
});

// ── resolveDressingRoomDisplay ────────────────────────────────────────────────

describe("resolveDressingRoomDisplay", () => {
  it("returns code when provided", () => {
    expect(resolveDressingRoomDisplay({ code: "G1" })).toBe("G1");
  });

  it("returns name as fallback when code is absent", () => {
    expect(resolveDressingRoomDisplay({ code: null, name: "Garderobe 1" })).toBe("Garderobe 1");
  });

  it("returns label when provided (priority over code)", () => {
    expect(
      resolveDressingRoomDisplay({ label: "E1", code: "G1", name: "Garderobe 1" }),
    ).toBe("E1");
  });

  it("returns null when all values are absent", () => {
    expect(resolveDressingRoomDisplay({ label: null, code: null, name: null })).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(resolveDressingRoomDisplay({})).toBeNull();
  });

  it("does not add a translated prefix to code", () => {
    const result = resolveDressingRoomDisplay({ code: "G1" });
    expect(result).toBe("G1");
    expect(result).not.toMatch(/^(Garderobe|Kabine|Dressing Room|Room)/i);
  });

  it("does not add a translated prefix to name", () => {
    const result = resolveDressingRoomDisplay({ name: "E1" });
    expect(result).toBe("E1");
    expect(result).not.toMatch(/^(Garderobe|Kabine|Dressing Room|Room)/i);
  });

  it("does not mutate the input object", () => {
    const input: DressingRoomDisplayInput = Object.freeze({
      code: "G1",
      name: "Garderobe 1",
    });
    resolveDressingRoomDisplay(input);
    expect(input.code).toBe("G1");
    expect(input.name).toBe("Garderobe 1");
  });
});

// ── resolveAllocationList ─────────────────────────────────────────────────────

describe("resolveAllocationList", () => {
  it("returns null for an empty array", () => {
    expect(resolveAllocationList([])).toBeNull();
  });

  it("returns the single resolved item", () => {
    expect(resolveAllocationList([{ code: "KR2" }])).toBe("KR2");
  });

  it("joins multiple items with ' · ' by default", () => {
    expect(
      resolveAllocationList([{ code: "KR2" }, { code: "KR3" }]),
    ).toBe("KR2 · KR3");
  });

  it("omits unresolved items", () => {
    expect(
      resolveAllocationList([{ code: "A" }, {}, { code: "B" }]),
    ).toBe("A · B");
  });

  it("omits items with only blank fields", () => {
    expect(
      resolveAllocationList([
        { code: "A" },
        { code: "  ", name: "" },
        { code: "B" },
      ]),
    ).toBe("A · B");
  });

  it("returns null when all items resolve to null", () => {
    expect(resolveAllocationList([{}, { code: null, name: "" }])).toBeNull();
  });

  it("preserves input order", () => {
    expect(
      resolveAllocationList([{ code: "C" }, { code: "A" }, { code: "B" }]),
    ).toBe("C · A · B");
  });

  it("removes exact duplicates by default", () => {
    expect(
      resolveAllocationList([{ code: "A" }, { code: "A" }]),
    ).toBe("A");
  });

  it("retains strings with different capitalization as distinct", () => {
    expect(
      resolveAllocationList([{ code: "A" }, { code: "a" }]),
    ).toBe("A · a");
  });

  it("retains duplicates when deduplicate=false", () => {
    expect(
      resolveAllocationList([{ code: "A" }, { code: "A" }], { deduplicate: false }),
    ).toBe("A · A");
  });

  it("respects a custom separator", () => {
    expect(
      resolveAllocationList([{ code: "A" }, { code: "B" }], { separator: " / " }),
    ).toBe("A / B");
  });

  it("respects an explicit empty separator", () => {
    expect(
      resolveAllocationList([{ code: "A" }, { code: "B" }], { separator: "" }),
    ).toBe("AB");
  });

  it("treats separator='' as valid (does not fall back to default)", () => {
    const result = resolveAllocationList(
      [{ code: "X" }, { code: "Y" }],
      { separator: "" },
    );
    expect(result).toBe("XY");
    expect(result).not.toContain(" · ");
  });

  it("does not mutate the source array", () => {
    const inputs: AllocationResourceInput[] = [{ code: "A" }, { code: "B" }];
    const copy = [...inputs];
    resolveAllocationList(inputs);
    expect(inputs).toEqual(copy);
    expect(inputs.length).toBe(2);
  });

  it("does not mutate source objects within the array", () => {
    const item: AllocationResourceInput = Object.freeze({ code: "KR2", name: "Kunstrasen 2" });
    resolveAllocationList([item]);
    expect(item.code).toBe("KR2");
    expect(item.name).toBe("Kunstrasen 2");
  });

  it("does not mutate the options object", () => {
    const options: ResolveAllocationListOptions = Object.freeze({
      separator: " | ",
      deduplicate: false,
    });
    resolveAllocationList([{ code: "A" }, { code: "B" }], options);
    expect(options.separator).toBe(" | ");
    expect(options.deduplicate).toBe(false);
  });

  it("deduplication is case-sensitive (A and a are both kept)", () => {
    const result = resolveAllocationList([
      { name: "Garderobe A" },
      { name: "garderobe a" },
      { name: "Garderobe A" },
    ]);
    expect(result).toBe("Garderobe A · garderobe a");
  });

  it("handles three items including one duplicate", () => {
    expect(
      resolveAllocationList([
        { code: "KR2" },
        { code: "KR3" },
        { code: "KR2" },
      ]),
    ).toBe("KR2 · KR3");
  });
});
