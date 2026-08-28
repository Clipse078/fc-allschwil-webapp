import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import { listAllocationsByTrainingSeries } from "@/lib/training/training-allocation-service";
import { listTrainingSeries } from "@/lib/training/training-service";
import type { Weekday } from "@/lib/training/types";

export type TeamTrainingScheduleEntry = {
  weekday: Weekday;
  weekdayLabel: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string | null;
  seriesId: string;
  seriesTitle: string;
};

const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const TEAM_TRAINING_WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Montag",
  TUESDAY: "Dienstag",
  WEDNESDAY: "Mittwoch",
  THURSDAY: "Donnerstag",
  FRIDAY: "Freitag",
  SATURDAY: "Samstag",
  SUNDAY: "Sonntag",
};

/**
 * Read-only training schedule for the Team Cockpit.
 * Sources canonical TrainingSeries + TrainingAllocation data for one TeamSeason.
 */
export async function getTeamTrainingSchedule(
  tenantId: string,
  teamSeasonId: string,
): Promise<TeamTrainingScheduleEntry[]> {
  const seriesList = await listTrainingSeries(tenantId, { teamSeasonId });
  const activeSeries = seriesList.filter((series) => series.status === "ACTIVE");

  const entries: TeamTrainingScheduleEntry[] = [];

  for (const series of activeSeries) {
    const allocations = await listAllocationsByTrainingSeries(tenantId, series.id);
    const pitchAllocation = allocations.find(
      (allocation) => classifyFacilityResourceType(allocation.facilityResourceType) === "PITCH_HALL",
    );
    const locationLabel =
      pitchAllocation?.facilityResourceName?.trim() ||
      pitchAllocation?.facilityResourceCode?.trim() ||
      null;

    for (const schedule of series.weekdaySchedules) {
      entries.push({
        weekday: schedule.weekday,
        weekdayLabel: TEAM_TRAINING_WEEKDAY_LABELS[schedule.weekday],
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        locationLabel,
        seriesId: series.id,
        seriesTitle: series.title,
      });
    }
  }

  return entries.sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday),
  );
}
