import { zonedTimeToUtc } from "@/lib/training/recurrence";
import type { Weekday } from "@/lib/training/types";
import type { TeamTrainingScheduleEntry } from "@/lib/teams/team-training-schedule";
import type { PublicTeamTrainingSession } from "@/lib/website/types";

const WEEKDAY_REFERENCE_DATE: Record<Weekday, string> = {
  MONDAY: "2026-01-05",
  TUESDAY: "2026-01-06",
  WEDNESDAY: "2026-01-07",
  THURSDAY: "2026-01-08",
  FRIDAY: "2026-01-09",
  SATURDAY: "2026-01-10",
  SUNDAY: "2026-01-11",
};

const DEFAULT_TIMEZONE = "Europe/Zurich";

/**
 * Maps canonical Team Cockpit training schedule entries to the public team
 * detail contract. Uses stable reference dates per weekday so recurring
 * HH:mm times can be expressed as ISO timestamps without generating future
 * event instances.
 */
export function mapPublicTeamTrainingSchedule(
  entries: TeamTrainingScheduleEntry[],
  timezone = DEFAULT_TIMEZONE,
): PublicTeamTrainingSession[] {
  return entries.map((entry) => {
    const dateKey = WEEKDAY_REFERENCE_DATE[entry.weekday];
    const startAt = zonedTimeToUtc(dateKey, entry.startsAt, timezone);
    const endAt = zonedTimeToUtc(dateKey, entry.endsAt, timezone);

    return {
      weekday: entry.weekdayLabel,
      startTime: startAt.toISOString(),
      endTime: endAt.toISOString(),
      clubName: entry.clubName,
      teamDisplayName: entry.teamDisplayName,
      seriesDisplayName: entry.seriesDisplayName,
      location: entry.pitch?.displayName ?? entry.locationLabel,
      pitchName: entry.pitch?.displayName ?? entry.locationLabel,
      pitch: entry.pitch,
      dressingRoom: entry.dressingRoom,
    };
  });
}
