/**
 * TEAM-COCKPIT-02B — attendance statistics tests
 */

import { describe, it, expect } from "vitest";
import {
  calculateAttendancePercentage,
  countStatuses,
  formatAttendancePercentage,
  isDenominatorStatus,
} from "../statistics";

describe("TEAM-COCKPIT-02B — attendance statistics", () => {
  it("excludes OPEN from the percentage denominator", () => {
    const counts = countStatuses(["OPEN", "PRESENT", "ABSENT", "OPEN", "EXCUSED"]);
    expect(counts.open).toBe(2);
    expect(calculateAttendancePercentage(counts)).toBe(1 / 3);
  });

  it("returns null for zero denominator", () => {
    const counts = countStatuses(["OPEN", "OPEN"]);
    expect(calculateAttendancePercentage(counts)).toBeNull();
    expect(formatAttendancePercentage(null)).toBe("—");
  });

  it("includes EXCUSED and INJURED in the denominator", () => {
    const counts = countStatuses(["PRESENT", "EXCUSED", "INJURED"]);
    expect(calculateAttendancePercentage(counts)).toBeCloseTo(1 / 3);
    expect(isDenominatorStatus("EXCUSED")).toBe(true);
    expect(isDenominatorStatus("INJURED")).toBe(true);
    expect(isDenominatorStatus("OPEN")).toBe(false);
  });

  it("formats percentage as rounded percent", () => {
    expect(formatAttendancePercentage(0.666)).toBe("67%");
  });
});
