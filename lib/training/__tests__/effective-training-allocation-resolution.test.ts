/**
 * WOCHENPLAN-CANONICAL-UPSTREAM-01 — occurrence-specific training allocation
 * resolution regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  resolveTrainingOccurrenceAllocationGroup,
  resolveTrainingOccurrenceAllocations,
  type TrainingAllocationResourceRow,
} from "../effective-training-allocation-resolution";

function resource(
  code: string,
  name: string,
  type: "HALF_PITCH" | "DRESSING_ROOM",
  displayOrder: number,
  createdAt?: Date,
): TrainingAllocationResourceRow {
  return {
    displayOrder,
    createdAt,
    facilityResource: {
      id: `res-${code}`,
      code,
      name,
      type,
      facility: { name: "Sportanlage" },
    },
  };
}

describe("resolveTrainingOccurrenceAllocationGroup", () => {
  it("prefers occurrence-level dressing room override over series default", () => {
    const seriesRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];
    const sessionRows = [resource("E3", "Garderobe E3", "DRESSING_ROOM", 0)];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      sessionRows,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.facilityResource.code).toBe("E3");
  });

  it("keeps Monday and Wednesday dressing rooms independent via occurrence overrides", () => {
    const seriesRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];
    const mondayOverride = [resource("E4", "Garderobe E4", "DRESSING_ROOM", 0)];
    const wednesdayOverride = [resource("O3", "Garderobe O3", "DRESSING_ROOM", 0)];

    expect(
      resolveTrainingOccurrenceAllocationGroup("DRESSING_ROOM", seriesRows, mondayOverride)[0]
        ?.facilityResource.code,
    ).toBe("E4");
    expect(
      resolveTrainingOccurrenceAllocationGroup("DRESSING_ROOM", seriesRows, wednesdayOverride)[0]
        ?.facilityResource.code,
    ).toBe("O3");
  });

  it("resolves pitch and dressing room independently per occurrence", () => {
    const seriesRows = [
      resource("KR3B", "Kunstrasen 3 B", "HALF_PITCH", 0),
      resource("O4", "Garderobe O4", "DRESSING_ROOM", 0),
    ];
    const sessionRows = [
      resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      resource("E3", "Garderobe E3", "DRESSING_ROOM", 0),
    ];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.pitch[0]?.facilityResource.code).toBe("KR3A");
    expect(resolved.dressingRoom[0]?.facilityResource.code).toBe("E3");
  });

  it("does not let arbitrary series allocation ordering pick the dressing room", () => {
    const seriesRows = [
      resource("O4", "Garderobe O4", "DRESSING_ROOM", 5, new Date("2026-01-02T00:00:00.000Z")),
      resource("E3", "Garderobe E3", "DRESSING_ROOM", 0, new Date("2026-01-03T00:00:00.000Z")),
    ];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      [],
    );

    expect(resolved[0]?.facilityResource.code).toBe("E3");
  });

  it("returns empty when canonical occurrence and series allocations are absent", () => {
    expect(resolveTrainingOccurrenceAllocationGroup("DRESSING_ROOM", [], [])).toEqual([]);
  });

  it("D9-D1 Wednesday canonical E3 cannot become stale O4 when session override exists", () => {
    const seriesRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];
    const sessionRows = [resource("E3", "Garderobe E3", "DRESSING_ROOM", 0)];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.dressingRoom[0]?.facilityResource.name).toBe("Garderobe E3");
  });
});
