import { describe, expect, it } from "vitest";

import { mapPublicTeamTrainingSchedule } from "../public-team-training-mapper";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";

describe("mapPublicTeamTrainingSchedule", () => {
  it("maps canonical schedule entries to the public team detail contract", () => {
    const entries: TeamTrainingScheduleEntry[] = [
      {
        weekday: "TUESDAY",
        weekdayLabel: "Dienstag",
        startsAt: "17:15",
        endsAt: "18:45",
        locationLabel: "Kunstrasen 2",
        seriesId: "series-1",
        seriesTitle: "E1 Training",
      },
    ];

    const training = mapPublicTeamTrainingSchedule(entries);

    expect(training).toEqual([
      {
        weekday: "Dienstag",
        startTime: "2026-01-06T16:15:00.000Z",
        endTime: "2026-01-06T17:45:00.000Z",
        location: "Kunstrasen 2",
        pitchName: "Kunstrasen 2",
      },
    ]);
  });
});
