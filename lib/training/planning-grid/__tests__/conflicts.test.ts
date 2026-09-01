import { describe, expect, it } from "vitest";
import { detectResourceConflicts } from "../conflicts";
import type { ConflictOccupancy } from "../conflicts";

describe("detectResourceConflicts", () => {
  it("detects direct resource overlap between two activities", () => {
    const occupancies: ConflictOccupancy[] = [
      {
        sessionId: "s1",
        teamName: "Team A",
        trainingSeriesTitle: "Series A",
        resourceId: "r1",
        resourceName: "Court 1",
        startAt: "2026-09-02T15:00:00.000Z",
        endAt: "2026-09-02T16:00:00.000Z",
      },
      {
        sessionId: "s2",
        teamName: "Team B",
        trainingSeriesTitle: "Series B",
        resourceId: "r1",
        resourceName: "Court 1",
        startAt: "2026-09-02T15:30:00.000Z",
        endAt: "2026-09-02T16:30:00.000Z",
      },
    ];

    const conflicts = detectResourceConflicts(occupancies);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].sessionIds.sort()).toEqual(["s1", "s2"]);
    expect(conflicts[0].activityLabels).toEqual(["Team A", "Team B"]);
  });

  it("does not flag non-overlapping bookings on the same resource", () => {
    const occupancies: ConflictOccupancy[] = [
      {
        sessionId: "s1",
        teamName: "Team A",
        trainingSeriesTitle: "A",
        resourceId: "r1",
        resourceName: "Court 1",
        startAt: "2026-09-02T15:00:00.000Z",
        endAt: "2026-09-02T16:00:00.000Z",
      },
      {
        sessionId: "s2",
        teamName: "Team B",
        trainingSeriesTitle: "B",
        resourceId: "r1",
        resourceName: "Court 1",
        startAt: "2026-09-02T16:00:00.000Z",
        endAt: "2026-09-02T17:00:00.000Z",
      },
    ];
    expect(detectResourceConflicts(occupancies)).toHaveLength(0);
  });

  it("does not flag same-time bookings on different resources", () => {
    const occupancies: ConflictOccupancy[] = [
      {
        sessionId: "s1",
        teamName: "Team A",
        trainingSeriesTitle: "A",
        resourceId: "r1",
        resourceName: "Court 1 A",
        startAt: "2026-09-02T15:00:00.000Z",
        endAt: "2026-09-02T16:00:00.000Z",
      },
      {
        sessionId: "s2",
        teamName: "Team B",
        trainingSeriesTitle: "B",
        resourceId: "r2",
        resourceName: "Court 1 B",
        startAt: "2026-09-02T15:00:00.000Z",
        endAt: "2026-09-02T16:00:00.000Z",
      },
    ];
    expect(detectResourceConflicts(occupancies)).toHaveLength(0);
  });
});
