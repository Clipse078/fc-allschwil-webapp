import { describe, expect, it } from "vitest";
import { isValidPlanningCategory } from "@/lib/training/planning-grid/data-service";

describe("planning grid API helpers", () => {
  it("validates planning categories", () => {
    expect(isValidPlanningCategory("PITCH_HALL")).toBe(true);
    expect(isValidPlanningCategory("DRESSING_ROOM")).toBe(true);
    expect(isValidPlanningCategory("OTHER")).toBe(true);
    expect(isValidPlanningCategory("FOOTBALL")).toBe(false);
  });
});
