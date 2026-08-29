/**
 * lib/wochenplan/__tests__/plan-baseline.test.ts
 *
 * WOCHENPLAN-2.0-01H-D — empty-baseline marker helpers.
 */

import { describe, expect, it } from "vitest";
import {
  WOCHEPLAN_EMPTY_BASELINE_MARKER,
  buildEmptyBaselineDescription,
  getWochenplanPlanBaselineMode,
  isEmptyBaselineDescription,
  preserveBaselineOnDescriptionUpdate,
  stripBaselineMarker,
} from "../plan-baseline";

describe("plan-baseline", () => {
  it("detects empty baseline marker in description", () => {
    expect(isEmptyBaselineDescription(WOCHEPLAN_EMPTY_BASELINE_MARKER)).toBe(true);
    expect(isEmptyBaselineDescription(`${WOCHEPLAN_EMPTY_BASELINE_MARKER}Notizen`)).toBe(true);
    expect(isEmptyBaselineDescription(null)).toBe(false);
    expect(isEmptyBaselineDescription("Normal")).toBe(false);
  });

  it("returns canonical mode by default and empty when marker is present", () => {
    expect(getWochenplanPlanBaselineMode(null)).toBe("canonical");
    expect(getWochenplanPlanBaselineMode(WOCHEPLAN_EMPTY_BASELINE_MARKER)).toBe("empty");
  });

  it("builds and strips marker-prefixed descriptions", () => {
    expect(buildEmptyBaselineDescription()).toBe(WOCHEPLAN_EMPTY_BASELINE_MARKER);
    expect(buildEmptyBaselineDescription("Hinweis")).toBe(`${WOCHEPLAN_EMPTY_BASELINE_MARKER}Hinweis`);
    expect(stripBaselineMarker(`${WOCHEPLAN_EMPTY_BASELINE_MARKER}Hinweis`)).toBe("Hinweis");
    expect(stripBaselineMarker(WOCHEPLAN_EMPTY_BASELINE_MARKER)).toBeNull();
  });

  it("preserves empty baseline marker across description updates", () => {
    expect(preserveBaselineOnDescriptionUpdate(WOCHEPLAN_EMPTY_BASELINE_MARKER, "Neu")).toBe(
      `${WOCHEPLAN_EMPTY_BASELINE_MARKER}Neu`,
    );
    expect(preserveBaselineOnDescriptionUpdate("Normal", "Neu")).toBe("Neu");
  });
});
