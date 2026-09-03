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
  updatedAt?: Date,
): TrainingAllocationResourceRow {
  return {
    displayOrder,
    createdAt,
    updatedAt,
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
  it("prefers occurrence dressing-room override over series default (series E3 + occurrence O4 => O4)", () => {
    const seriesRows = [resource("E3", "Garderobe E3", "DRESSING_ROOM", 0)];
    const sessionRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      sessionRows,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.facilityResource.code).toBe("O4");
  });

  it("uses series pitch when no occurrence pitch override exists", () => {
    const seriesRows = [resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0)];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "PITCH_HALL",
      seriesRows,
      [],
    );

    expect(resolved[0]?.facilityResource.code).toBe("KR3A");
  });

  it("uses series dressing room when no occurrence dressing-room override exists", () => {
    const seriesRows = [resource("E3", "Garderobe E3", "DRESSING_ROOM", 0)];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      [],
    );

    expect(resolved[0]?.facilityResource.code).toBe("E3");
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

  it("uses occurrence pitch override and series dressing room when only pitch is overridden", () => {
    const seriesRows = [
      resource("KR3B", "Kunstrasen 3 B", "HALF_PITCH", 0),
      resource("E3", "Garderobe E3", "DRESSING_ROOM", 0),
    ];
    const sessionRows = [resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0)];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.pitch[0]?.facilityResource.code).toBe("KR3A");
    expect(resolved.dressingRoom[0]?.facilityResource.code).toBe("E3");
  });

  it("uses series pitch and occurrence dressing-room override when only dressing room is overridden", () => {
    const seriesRows = [
      resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      resource("E3", "Garderobe E3", "DRESSING_ROOM", 0),
    ];
    const sessionRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.pitch[0]?.facilityResource.code).toBe("KR3A");
    expect(resolved.dressingRoom[0]?.facilityResource.code).toBe("O4");
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

  it("resolves multiple series dressing rooms in canonical displayOrder", () => {
    const seriesRows = [
      resource("O3", "Garderobe O3", "DRESSING_ROOM", 1, new Date("2026-01-02T00:00:00.000Z")),
      resource("E1", "Garderobe E1", "DRESSING_ROOM", 0, new Date("2026-01-03T00:00:00.000Z")),
    ];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      [],
    );

    expect(resolved.map((row) => row.facilityResource.code)).toEqual(["E1", "O3"]);
  });

  it("deduplicates multiple series dressing rooms by facilityResourceId", () => {
    const seriesRows = [
      resource("E1", "Garderobe E1", "DRESSING_ROOM", 0),
      resource("E1", "Garderobe E1", "DRESSING_ROOM", 1),
      resource("O3", "Garderobe O3", "DRESSING_ROOM", 2),
    ];

    const resolved = resolveTrainingOccurrenceAllocationGroup(
      "DRESSING_ROOM",
      seriesRows,
      [],
    );

    expect(resolved.map((row) => row.facilityResource.code)).toEqual(["E1", "O3"]);
  });

  it("returns all series dressing rooms when no occurrence override exists", () => {
    const seriesRows = [
      resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      resource("E1", "Garderobe E1", "DRESSING_ROOM", 0),
      resource("O3", "Garderobe O3", "DRESSING_ROOM", 1),
    ];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: [],
    });

    expect(resolved.pitch).toHaveLength(1);
    expect(resolved.dressingRoom.map((row) => row.facilityResource.code)).toEqual(["E1", "O3"]);
  });

  it("resolves multiple session siblings deterministically by highest displayOrder", () => {
    const seriesRows = [resource("O4", "Garderobe O4", "DRESSING_ROOM", 0)];
    const sessionRows = [
      resource("O4", "Garderobe O4", "DRESSING_ROOM", 1, new Date("2026-01-01T00:00:00.000Z")),
      resource("E3", "Garderobe E3", "DRESSING_ROOM", 2, new Date("2026-01-02T00:00:00.000Z")),
    ];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.dressingRoom[0]?.facilityResource.code).toBe("E3");
  });

  it("returns empty when canonical occurrence and series allocations are absent", () => {
    expect(resolveTrainingOccurrenceAllocationGroup("DRESSING_ROOM", [], [])).toEqual([]);
  });

  it("D9 production shape: series KR3 A / E3 with occurrence dressing-room O4 => KR3 A / O4", () => {
    const seriesRows = [
      resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH", 0),
      resource(
        "E3",
        "Garderobe E3",
        "DRESSING_ROOM",
        0,
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-02-01T00:00:00.000Z"),
      ),
    ];
    const sessionRows = [
      resource(
        "O4",
        "Garderobe O4",
        "DRESSING_ROOM",
        0,
        new Date("2026-08-31T00:00:00.000Z"),
      ),
    ];

    const resolved = resolveTrainingOccurrenceAllocations({
      seriesRows,
      sessionOverrideRows: sessionRows,
    });

    expect(resolved.pitch[0]?.facilityResource.code).toBe("KR3A");
    expect(resolved.dressingRoom[0]?.facilityResource.code).toBe("O4");
  });
});
