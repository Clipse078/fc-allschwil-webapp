import { describe, expect, it } from "vitest";

import { mapPublicTeamTrainingSchedule } from "../public-team-training-mapper";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";

describe("mapPublicTeamTrainingSchedule", () => {
  it("maps canonical schedule entries to the hardened public team detail contract", () => {
    const entries: TeamTrainingScheduleEntry[] = [
      {
        weekday: "TUESDAY",
        weekdayLabel: "Dienstag",
        startsAt: "17:15",
        endsAt: "18:45",
        clubName: "FC Allschwil",
        teamDisplayName: "Junioren D-7 D1",
        seriesDisplayName: "Junioren D-7 D1 Training",
        pitch: {
          id: "res-pitch",
          name: "Kunstrasen 3 B",
          displayName: "Kunstrasen 3 B",
        },
        dressingRoom: {
          id: "res-room",
          name: "E4",
          displayName: "E4",
        },
        locationLabel: "Kunstrasen 3 B",
        seriesId: "series-1",
        seriesTitle: "Junioren D-7 D1 Training",
      },
    ];

    const training = mapPublicTeamTrainingSchedule(entries);

    expect(training).toEqual([
      {
        weekday: "Dienstag",
        startTime: "2026-01-06T16:15:00.000Z",
        endTime: "2026-01-06T17:45:00.000Z",
        clubName: "FC Allschwil",
        teamDisplayName: "Junioren D-7 D1",
        seriesDisplayName: "Junioren D-7 D1 Training",
        location: "Kunstrasen 3 B",
        pitchName: "Kunstrasen 3 B",
        pitch: {
          id: "res-pitch",
          name: "Kunstrasen 3 B",
          displayName: "Kunstrasen 3 B",
        },
        dressingRoom: {
          id: "res-room",
          name: "E4",
          displayName: "E4",
        },
      },
    ]);
  });
});
