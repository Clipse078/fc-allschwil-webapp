/**
 * lib/training/__tests__/allocation-groups.test.ts
 *
 * TRAININGCENTER-01B — regression tests for the allocation-editor UI
 * grouping (Spielfeld/Halle | Garderobe | Weitere Ressourcen).
 */

import { describe, expect, it } from "vitest";
import {
  classifyFacilityResourceType,
  groupAllocationsByAllocationGroup,
  splitFacilityGroupsByAllocationGroup,
  TRAINING_ALLOCATION_GROUP_LABELS,
} from "../allocation-groups";

describe("classifyFacilityResourceType", () => {
  it("classifies FULL_PITCH and HALF_PITCH as PITCH_HALL", () => {
    expect(classifyFacilityResourceType("FULL_PITCH")).toBe("PITCH_HALL");
    expect(classifyFacilityResourceType("HALF_PITCH")).toBe("PITCH_HALL");
  });

  it("classifies DRESSING_ROOM as DRESSING_ROOM", () => {
    expect(classifyFacilityResourceType("DRESSING_ROOM")).toBe("DRESSING_ROOM");
  });

  it("classifies OTHER (and any unrecognised type) as OTHER", () => {
    expect(classifyFacilityResourceType("OTHER")).toBe("OTHER");
    expect(classifyFacilityResourceType("SOME_FUTURE_TYPE")).toBe("OTHER");
  });

  it("has a German label for every group", () => {
    expect(TRAINING_ALLOCATION_GROUP_LABELS.PITCH_HALL).toBe("Spielfeld / Halle");
    expect(TRAINING_ALLOCATION_GROUP_LABELS.DRESSING_ROOM).toBe("Garderobe");
    expect(TRAINING_ALLOCATION_GROUP_LABELS.OTHER).toBe("Weitere Ressourcen");
  });
});

describe("splitFacilityGroupsByAllocationGroup", () => {
  const facilityGroups = [
    {
      facilityId: "facility-1",
      facilityName: "Sportanlage Brüel",
      resources: [
        { id: "r1", type: "FULL_PITCH" },
        { id: "r2", type: "HALF_PITCH" },
        { id: "r3", type: "DRESSING_ROOM" },
        { id: "r4", type: "OTHER" },
      ],
    },
    {
      facilityId: "facility-2",
      facilityName: "Turnhalle Bettenacker",
      resources: [
        { id: "r5", type: "DRESSING_ROOM" },
      ],
    },
  ];

  it("groups pitch/hall resources across facilities", () => {
    const result = splitFacilityGroupsByAllocationGroup(facilityGroups);
    expect(result.PITCH_HALL).toHaveLength(1);
    expect(result.PITCH_HALL[0].facilityId).toBe("facility-1");
    expect(result.PITCH_HALL[0].resources.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("groups dressing-room resources across facilities", () => {
    const result = splitFacilityGroupsByAllocationGroup(facilityGroups);
    expect(result.DRESSING_ROOM).toHaveLength(2);
    expect(result.DRESSING_ROOM.map((fg) => fg.facilityId)).toEqual(["facility-1", "facility-2"]);
    expect(result.DRESSING_ROOM[0].resources.map((r) => r.id)).toEqual(["r3"]);
    expect(result.DRESSING_ROOM[1].resources.map((r) => r.id)).toEqual(["r5"]);
  });

  it("groups OTHER resources and drops facilities with none", () => {
    const result = splitFacilityGroupsByAllocationGroup(facilityGroups);
    expect(result.OTHER).toHaveLength(1);
    expect(result.OTHER[0].facilityId).toBe("facility-1");
    expect(result.OTHER[0].resources.map((r) => r.id)).toEqual(["r4"]);
  });

  it("returns empty arrays for a group with no matching resources at all", () => {
    const result = splitFacilityGroupsByAllocationGroup([
      { facilityId: "f1", facilityName: "F1", resources: [{ id: "r1", type: "DRESSING_ROOM" }] },
    ]);
    expect(result.PITCH_HALL).toEqual([]);
    expect(result.OTHER).toEqual([]);
  });

  it("does not mutate the input facilityGroups", () => {
    const original = JSON.parse(JSON.stringify(facilityGroups));
    splitFacilityGroupsByAllocationGroup(facilityGroups);
    expect(facilityGroups).toEqual(original);
  });
});

describe("groupAllocationsByAllocationGroup", () => {
  it("splits a flat allocation list into the three groups", () => {
    const allocations = [
      { id: "a1", facilityResourceType: "FULL_PITCH" },
      { id: "a2", facilityResourceType: "HALF_PITCH" },
      { id: "a3", facilityResourceType: "DRESSING_ROOM" },
      { id: "a4", facilityResourceType: "OTHER" },
    ];

    const result = groupAllocationsByAllocationGroup(allocations);

    expect(result.PITCH_HALL.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(result.DRESSING_ROOM.map((a) => a.id)).toEqual(["a3"]);
    expect(result.OTHER.map((a) => a.id)).toEqual(["a4"]);
  });

  it("returns empty arrays for an empty allocation list", () => {
    const result = groupAllocationsByAllocationGroup([]);
    expect(result).toEqual({ PITCH_HALL: [], DRESSING_ROOM: [], OTHER: [] });
  });
});
