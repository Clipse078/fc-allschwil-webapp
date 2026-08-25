/**
 * TEAM-COCKPIT-03A — participation does not affect attendance statistics
 */

import { describe, it, expect } from "vitest";
import { calculateAttendancePercentage, countStatuses } from "@/lib/attendance/statistics";
import { countParticipationStatuses } from "../statistics";

describe("TEAM-COCKPIT-03A — participation vs attendance separation", () => {
  it("participation YES does not enter attendance percentage", () => {
    const participationCounts = countParticipationStatuses(["YES", "YES", "NO", "OPEN"]);
    expect(participationCounts.yes).toBe(2);

    const attendanceCounts = countStatuses(["OPEN", "OPEN"]);
    const percentage = calculateAttendancePercentage(attendanceCounts);
    expect(percentage).toBeNull();
    expect(attendanceCounts.present).toBe(0);
  });

  it("attendance formula remains PRESENT / (PRESENT + ABSENT + EXCUSED + INJURED)", () => {
    const counts = countStatuses(["PRESENT", "ABSENT", "EXCUSED", "OPEN"]);
    expect(calculateAttendancePercentage(counts)).toBe(1 / 3);
  });
});
