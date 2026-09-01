/**
 * SCE-CANONICAL-PUBLISHING-01 — public weekplan TRAINING resource contract tests.
 *
 * Proves the full pipeline from canonical occurrence resolution through the
 * public Wochenplan DTO: a website consumer receives final effective pitch
 * and dressing-room values without team-detail reconciliation.
 */

import { describe, expect, it } from "vitest";
import {
  resolveTrainingOccurrenceAllocations,
  type TrainingAllocationResourceRow,
} from "@/lib/training/effective-training-allocation-resolution";
import {
  mapTrainingToPublicEvent,
  resolveTrainingTeamContext,
} from "../public-feed-mapper";
import type { WeekplannerResourceRef, WeekplannerTrainingItem } from "@/lib/weekplanner/types";

function resource(
  code: string,
  name: string,
  type: "HALF_PITCH" | "DRESSING_ROOM",
  displayOrder = 0,
): TrainingAllocationResourceRow {
  return {
    displayOrder,
    facilityResource: {
      id: `res-${code}`,
      code,
      name,
      type,
      facility: { name: type === "DRESSING_ROOM" ? "Garderobentrakt" : "Sportanlage" },
    },
  };
}

function toWeekplannerRefs(rows: readonly TrainingAllocationResourceRow[]): WeekplannerResourceRef[] {
  return rows.map((row) => ({
    facilityResourceId: row.facilityResource.id,
    code: row.facilityResource.code,
    name: row.facilityResource.name,
    facilityName: row.facilityResource.facility.name,
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
  }));
}

function buildTrainingItem(input: {
  pitchAllocations: WeekplannerResourceRef[];
  dressingRoomAllocations: WeekplannerResourceRef[];
  title?: string;
}): WeekplannerTrainingItem {
  return {
    id: "training:session-contract",
    tenantId: "tenant-a",
    type: "TRAINING",
    startAt: new Date("2026-09-02T16:45:00.000Z"),
    endAt: new Date("2026-09-02T18:15:00.000Z"),
    canonicalStartAt: new Date("2026-09-02T16:45:00.000Z"),
    canonicalEndAt: new Date("2026-09-02T18:15:00.000Z"),
    timeOverridden: false,
    title: input.title ?? "Junioren D-9 D1 Training",
    teamNames: ["Junioren D-9 D1"],
    pitchAllocations: input.pitchAllocations,
    dressingRoomAllocations: input.dressingRoomAllocations,
    canonicalPitchAllocations: input.pitchAllocations,
    canonicalDressingRoomAllocations: input.dressingRoomAllocations,
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-d9",
    trainingSessionId: "session-d9",
  };
}

function resolveAndMapPublicTraining(input: {
  seriesRows: readonly TrainingAllocationResourceRow[];
  sessionOverrideRows: readonly TrainingAllocationResourceRow[];
  title?: string;
}) {
  const resolved = resolveTrainingOccurrenceAllocations({
    seriesRows: input.seriesRows,
    sessionOverrideRows: input.sessionOverrideRows,
  });

  const item = buildTrainingItem({
    pitchAllocations: toWeekplannerRefs(resolved.pitch),
    dressingRoomAllocations: toWeekplannerRefs(resolved.dressingRoom),
    title: input.title,
  });

  return mapTrainingToPublicEvent(item, undefined, resolveTrainingTeamContext(undefined));
}

const SERIES_KR3A_E3 = [
  resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH"),
  resource("E3", "Garderobe E3", "DRESSING_ROOM"),
];

describe("public weekplan TRAINING effective resource contract", () => {
  it("A. series KR3 A / E3, no occurrence override → public event KR3 A / E3", () => {
    const mapped = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [],
    });

    expect(mapped.pitch?.name).toBe("Kunstrasen 3 A");
    expect(mapped.dressingRooms).toEqual([
      {
        name: "Garderobe E3",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
  });

  it("B. series KR3 A / E3, occurrence dressing O4 → public event KR3 A / O4", () => {
    const mapped = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [resource("O4", "Garderobe O4", "DRESSING_ROOM")],
    });

    expect(mapped.pitch?.name).toBe("Kunstrasen 3 A");
    expect(mapped.dressingRooms).toEqual([
      {
        name: "Garderobe O4",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
    expect(mapped.dressingRooms).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Garderobe E3" })]),
    );
  });

  it("C. series KR3 A / E3, occurrence pitch KR2 B only → public event KR2 B / E3", () => {
    const mapped = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [resource("KR2B", "Kunstrasen 2 B", "HALF_PITCH")],
    });

    expect(mapped.pitch?.name).toBe("Kunstrasen 2 B");
    expect(mapped.dressingRooms).toEqual([
      {
        name: "Garderobe E3",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
  });

  it("D. occurrence pitch + occurrence dressing → both occurrence values", () => {
    const mapped = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [
        resource("KR2B", "Kunstrasen 2 B", "HALF_PITCH"),
        resource("O4", "Garderobe O4", "DRESSING_ROOM"),
      ],
    });

    expect(mapped.pitch?.name).toBe("Kunstrasen 2 B");
    expect(mapped.dressingRooms).toEqual([
      {
        name: "Garderobe O4",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
  });

  it("E. resource groups remain independent (pitch override does not affect dressing)", () => {
    const seriesRows = [
      resource("KR3A", "Kunstrasen 3 A", "HALF_PITCH"),
      resource("O4", "Garderobe O4", "DRESSING_ROOM"),
    ];
    const sessionRows = [resource("KR2B", "Kunstrasen 2 B", "HALF_PITCH")];

    const mapped = resolveAndMapPublicTraining({ seriesRows, sessionOverrideRows: sessionRows });

    expect(mapped.pitch?.name).toBe("Kunstrasen 2 B");
    expect(mapped.dressingRooms?.[0]?.name).toBe("Garderobe O4");
  });

  it("F. removing occurrence override exposes series default again (no session overrides)", () => {
    const withOverride = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [resource("O4", "Garderobe O4", "DRESSING_ROOM")],
    });
    const withoutOverride = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [],
    });

    expect(withOverride.dressingRooms?.[0]?.name).toBe("Garderobe O4");
    expect(withoutOverride.dressingRooms?.[0]?.name).toBe("Garderobe E3");
    expect(withoutOverride.pitch?.name).toBe("Kunstrasen 3 A");
  });

  it("exposes seriesDisplayName for public training identity without team-detail enrichment", () => {
    const mapped = resolveAndMapPublicTraining({
      seriesRows: SERIES_KR3A_E3,
      sessionOverrideRows: [],
      title: "Junioren D-9 D1 Training",
    });

    expect(mapped.seriesDisplayName).toBe("Junioren D-9 D1 Training");
    expect(mapped.title).toBe("Junioren D-9 D1 Training");
  });
});
