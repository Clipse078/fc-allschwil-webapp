/**
 * WOCHENPLAN-CANONICAL-UPSTREAM-01 — public feed occurrence allocation tests.
 */

import { describe, expect, it } from "vitest";
import {
  mapTrainingDressingRooms,
  mapTrainingToPublicEvent,
  resolveTrainingTeamContext,
} from "../public-feed-mapper";
import type { WeekplannerTrainingItem } from "@/lib/weekplanner/types";

function room(code: string, name: string) {
  return {
    facilityResourceId: `res-${code}`,
    code,
    name,
    facilityName: "Garderobentrakt",
    occupancyBeforeMinutes: 0,
    occupancyAfterMinutes: 0,
  };
}

function trainingItem(overrides: Partial<WeekplannerTrainingItem> = {}): WeekplannerTrainingItem {
  return {
    id: "training:session-1",
    tenantId: "tenant-a",
    type: "TRAINING",
    startAt: new Date("2026-08-26T16:45:00.000Z"),
    endAt: new Date("2026-08-26T18:15:00.000Z"),
    canonicalStartAt: new Date("2026-08-26T16:45:00.000Z"),
    canonicalEndAt: new Date("2026-08-26T18:15:00.000Z"),
    timeOverridden: false,
    title: "Junioren D-9 D1 Training",
    teamNames: ["Junioren D-9 D1"],
    pitchAllocations: [room("KR3A", "Kunstrasen 3 A")],
    dressingRoomAllocations: [room("E3", "Garderobe E3")],
    canonicalPitchAllocations: [],
    canonicalDressingRoomAllocations: [],
    pitchOverridden: false,
    dressingRoomOverridden: false,
    conflicts: [],
    trainingSeriesId: "series-d9",
    trainingSessionId: "session-d9",
    ...overrides,
  };
}

describe("public feed training occurrence serialization", () => {
  it("serializes occurrence-specific pitch and dressing room values", () => {
    const mapped = mapTrainingToPublicEvent(
      trainingItem(),
      {
        id: "session-d9",
        status: "SCHEDULED",
        teamSeason: {
          season: { key: "2026-27" },
          team: {
            id: "team-d9",
            slug: "junioren-d9-d1",
            name: "FC Allschwil Junioren D-9 D1",
            shortName: null,
            alternativeName: null,
            infoboardDisplayName: null,
            infoboardTrainingDisplayName: null,
            infoboardMatchDisplayName: null,
            infoboardTournamentDisplayName: null,
          },
        },
      },
      resolveTrainingTeamContext(undefined),
    );

    expect(mapped.pitch?.name).toBe("Kunstrasen 3 A");
    expect(mapped.location).toBeTruthy();
    expect(mapped.dressingRooms).toEqual([
      {
        name: "Garderobe E3",
        facilityName: "Garderobentrakt",
        role: "TRAINING",
      },
    ]);
  });

  it("exposes seriesDisplayName without removing legacy title", () => {
    const mapped = mapTrainingToPublicEvent(
      trainingItem({ title: "Junioren D-9 D1 Training" }),
      undefined,
      resolveTrainingTeamContext(undefined),
    );

    expect(mapped.title).toBe("Junioren D-9 D1 Training");
    expect(mapped.seriesDisplayName).toBe("Junioren D-9 D1 Training");
  });

  it("returns null dressingRooms when occurrence has no dressing room allocation", () => {
    expect(mapTrainingDressingRooms(trainingItem({ dressingRoomAllocations: [] }))).toBeNull();
  });

  it("serializes the effective occurrence dressing room resolved upstream", () => {
    const mapped = mapTrainingToPublicEvent(
      trainingItem({
        pitchAllocations: [room("KR3A", "Kunstrasen 3 A")],
        dressingRoomAllocations: [room("O4", "Garderobe O4")],
      }),
      undefined,
      resolveTrainingTeamContext(undefined),
    );

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
});
