/**
 * lib/facilities/__tests__/resource-options.test.ts
 *
 * MASTERDATA-CONSISTENCY-02 — regression tests for the pure, I/O-free
 * withRequiredCodes() historical-compatibility helper shared by MatchCenter
 * and Wochenplan canonical resource selectors.
 */

import { describe, it, expect } from "vitest";
import { withRequiredCodes, type FacilityResourceOption } from "../resource-options";

const ACTIVE_OPTIONS: FacilityResourceOption[] = [
  { code: "E1", name: "Garderobe E1" },
  { code: "E2", name: "Garderobe E2" },
];

describe("withRequiredCodes", () => {
  it("returns the active options unchanged when all required codes are already active", () => {
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E1"]);
    expect(result).toEqual(ACTIVE_OPTIONS);
  });

  it("ignores null/undefined/blank required codes", () => {
    const result = withRequiredCodes(ACTIVE_OPTIONS, [null, undefined, ""]);
    expect(result).toEqual(ACTIVE_OPTIONS);
  });

  it("appends a fallback option for a required code that is not in the active set", () => {
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E9"]);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ code: "E9", name: "E9" });
  });

  it("uses the resolved display name for the fallback option when provided", () => {
    const fallbackNames = new Map([["E9", "Garderobe E9 (archiviert)"]]);
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E9"], fallbackNames);

    expect(result).toContainEqual({ code: "E9", name: "Garderobe E9 (archiviert)" });
  });

  it("does not duplicate an entry when the same required code appears twice", () => {
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E9", "E9"]);

    expect(result.filter((o) => o.code === "E9")).toHaveLength(1);
  });

  it("does not override the canonical active option's current name even if a fallback name map contains a stale value", () => {
    const fallbackNames = new Map([["E1", "Stale Old Name"]]);
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E1"], fallbackNames);

    expect(result.find((o) => o.code === "E1")).toEqual({ code: "E1", name: "Garderobe E1" });
  });

  it("merges multiple missing required codes, preserving active-option order first", () => {
    const result = withRequiredCodes(ACTIVE_OPTIONS, ["E9", "E10"]);

    expect(result.map((o) => o.code)).toEqual(["E1", "E2", "E9", "E10"]);
  });

  it("returns an empty array when both inputs are empty", () => {
    const result = withRequiredCodes([], []);
    expect(result).toEqual([]);
  });

  it("handles an entirely archived/renamed-away active list by still surfacing all required codes", () => {
    const result = withRequiredCodes([], ["E1", "E2"], new Map([["E1", "Garderobe E1 (archiviert)"]]));

    expect(result).toEqual([
      { code: "E1", name: "Garderobe E1 (archiviert)" },
      { code: "E2", name: "E2" },
    ]);
  });
});
