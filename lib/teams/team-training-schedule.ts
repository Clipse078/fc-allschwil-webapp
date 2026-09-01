import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import { listAllocationsByTrainingSeries } from "@/lib/training/training-allocation-service";
import { listTrainingSeries } from "@/lib/training/training-service";
import { resolveLongTeamName } from "@/lib/teams/team-naming";
import { prisma } from "@/lib/db/prisma";
import type { Weekday } from "@/lib/training/types";

export type TeamTrainingScheduleEntry = {
  weekday: Weekday;
  weekdayLabel: string;
  startsAt: string;
  endsAt: string;
  clubName: string | null;
  teamDisplayName: string | null;
  seriesDisplayName: string;
  pitch: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  dressingRoom: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  /** @deprecated Use pitch.displayName */
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

function toResourceRef(
  allocation:
    | {
        facilityResourceId: string;
        facilityResourceName: string;
      }
    | undefined,
): TeamTrainingScheduleEntry["pitch"] {
  if (!allocation) return null;
  const displayName = allocation.facilityResourceName.trim();
  if (!displayName) return null;
  return {
    id: allocation.facilityResourceId,
    name: displayName,
    displayName,
  };
}

/**
 * Read-only training schedule for the Team Cockpit and public Team Page.
 * Sources canonical TrainingSeries + TrainingAllocation data for one TeamSeason.
 */
export async function getTeamTrainingSchedule(
  tenantId: string,
  teamSeasonId: string,
  context?: {
    clubName?: string | null;
    teamDisplayName?: string | null;
  },
): Promise<TeamTrainingScheduleEntry[]> {
  const [seriesList, teamSeasonRow] = await Promise.all([
    listTrainingSeries(tenantId, { teamSeasonId }),
    prisma.teamSeason.findFirst({
      where: { id: teamSeasonId, team: { tenantId } },
      select: {
        displayName: true,
        team: {
          select: {
            name: true,
            shortName: true,
            alternativeName: true,
          },
        },
        externalMappings: {
          orderBy: { lastSyncedAt: "desc" },
          take: 1,
          select: { providerTeamName: true },
        },
      },
    }),
  ]);

  const resolvedTeamDisplayName =
    context?.teamDisplayName ??
    (teamSeasonRow
      ? resolveLongTeamName({
          teamName: teamSeasonRow.team.name,
          teamShortName: teamSeasonRow.team.shortName,
          teamAlternativeName: teamSeasonRow.team.alternativeName,
          teamSeasonDisplayName: teamSeasonRow.displayName,
          providerTeamName: teamSeasonRow.externalMappings[0]?.providerTeamName ?? null,
        })
      : null);

  const activeSeries = seriesList.filter((series) => series.status === "ACTIVE");

  const entries: TeamTrainingScheduleEntry[] = [];

  for (const series of activeSeries) {
    const allocations = await listAllocationsByTrainingSeries(tenantId, series.id);
    const pitchAllocation = allocations.find(
      (allocation) => classifyFacilityResourceType(allocation.facilityResourceType) === "PITCH_HALL",
    );
    const dressingRoomAllocation = allocations.find(
      (allocation) => classifyFacilityResourceType(allocation.facilityResourceType) === "DRESSING_ROOM",
    );
    const pitch = toResourceRef(pitchAllocation);
    const dressingRoom = toResourceRef(dressingRoomAllocation);
    const locationLabel = pitch?.displayName ?? null;

    for (const schedule of series.weekdaySchedules) {
      entries.push({
        weekday: schedule.weekday,
        weekdayLabel: TEAM_TRAINING_WEEKDAY_LABELS[schedule.weekday],
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        clubName: context?.clubName ?? null,
        teamDisplayName: resolvedTeamDisplayName,
        seriesDisplayName: series.title,
        pitch,
        dressingRoom,
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
