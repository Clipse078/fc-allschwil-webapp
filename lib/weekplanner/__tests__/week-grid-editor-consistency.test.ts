/**
 * WOCHENPLAN-2.0-01H-E7 — week-grid vs editor availability consistency tests.
 */

import { describe, expect, it } from "vitest";
import { detectWeekplannerConflicts } from "../view-model";
import type { WeekplannerTrainingItem } from "../types";

const PITCH_A = {
  facilityResourceId: "res-kr2a",
  code: "KR2_A",
  name: "Kunstrasen 2 A",
  facilityName: "Kunstrasen 2",
  occupancyBeforeMinutes: 0,
  occupancyAfterMinutes: 0,
};

const ROOM_E1 = {
  facilityResourceId: "res-e1",
  code: "E1",
  name: "Garderobe E1",
  facilityName: "Garderobentrakt",
  occupancyBeforeMinutes: 45,
  occupancyAfterMinutes: 30,
};

function trainingItem(
  sessionId: string,
  title: string,
  start: string,
  end: string,
  pitch = [PITCH_A],
  room = [ROOM_E1],
): WeekplannerTrainingItem {
  return {
    id: `training:${sessionId}`,
    tenantId: "tenant-a",
    type: "TRAINING",
    startAt: new Date(start),
    endAt: new Date(end),
    canonicalStartAt: new Date(start),
    canonicalEndAt: new Date(end),
    timeOverridden: false,
    title,
    teamNames: [title],
    pitchAllocations: pitch,
    dressingRoomAllocations: room,
    canonicalPitchAllocations: pitch,
    canonicalDressingRoomAllocations: room,
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: `series-${sessionId}`,
    trainingSessionId: sessionId,
  };
}

describe("week-grid vs editor occupancy consistency", () => {
  it("detectWeekplannerConflicts flags shared pitch occupancy between two trainings", () => {
    const eventA = trainingItem("session-a", "Junioren F2", "2026-08-10T15:00:00.000Z", "2026-08-10T16:30:00.000Z");
    const eventB = trainingItem("session-b", "Frauen 1", "2026-08-10T15:00:00.000Z", "2026-08-10T16:00:00.000Z");

    const annotated = detectWeekplannerConflicts([eventA, eventB]);

    expect(annotated.find((item) => item.id === eventA.id)?.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ facilityResourceId: PITCH_A.facilityResourceId, facilityResourceName: PITCH_A.name }),
      ]),
    );
    expect(annotated.find((item) => item.id === eventB.id)?.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ facilityResourceId: PITCH_A.facilityResourceId }),
      ]),
    );
  });

  it("detectWeekplannerConflicts flags shared dressing-room occupancy with buffers", () => {
    const eventA = trainingItem("session-a", "Junioren F2", "2026-08-10T14:00:00.000Z", "2026-08-10T17:00:00.000Z");
    const eventB = trainingItem("session-b", "Frauen 1", "2026-08-10T15:00:00.000Z", "2026-08-10T16:00:00.000Z");

    const annotated = detectWeekplannerConflicts([eventA, eventB]);

    expect(annotated.find((item) => item.id === eventB.id)?.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ facilityResourceId: ROOM_E1.facilityResourceId }),
      ]),
    );
  });

  it("adjacent half-open intervals do not conflict on pitch", () => {
    const noRoom: typeof ROOM_E1[] = [];
    const eventA = trainingItem("session-a", "Team A", "2026-08-10T15:00:00.000Z", "2026-08-10T16:00:00.000Z", [PITCH_A], noRoom);
    const eventB = trainingItem("session-b", "Team B", "2026-08-10T16:00:00.000Z", "2026-08-10T17:00:00.000Z", [PITCH_A], noRoom);

    const annotated = detectWeekplannerConflicts([eventA, eventB]);

    expect(annotated.find((item) => item.id === eventA.id)?.conflicts ?? []).toHaveLength(0);
    expect(annotated.find((item) => item.id === eventB.id)?.conflicts ?? []).toHaveLength(0);
  });
});
