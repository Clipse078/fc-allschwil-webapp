import { EventSource, EventType, PlanningResourceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDayWindow, getWeekWindow } from "@/lib/planner/date-utils";
import { getSeasonOptionsData } from "@/lib/seasons/queries";

export type PlannerEntry = {
  id: string;
  title: string;
  type: EventType;
  typeLabel: string;
  source: EventSource;
  sourceLabel: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  teamName: string | null;
  description: string | null;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  wochenplanVisible: boolean;
};

function getPlannerTypeLabel(type: EventType): string {
  switch (type) {
    case "TRAINING":
      return "Training";
    case "MATCH":
      return "Match";
    case "TOURNAMENT":
      return "Turnier";
    case "VACATION_PERIOD":
      return "Ferienperiode";
    case "OTHER":
      return "Weiteres Event";
    default:
      return type;
  }
}

function getPlannerSourceLabel(source: EventSource): string {
  switch (source) {
    case "MANUAL":
      return "Manuell";
    case "CLUBCORNER_FVNWS":
      return "FVNWS API";
    case "CSV_EXCEL_IMPORT":
      return "CSV / Excel";
    case "MUNICIPALITY_API":
      return "Gemeinde API";
    default:
      return source;
  }
}

function toDateTimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function resolveSelectedSeason(selectedSeasonKey?: string | null) {
  const seasons = await getSeasonOptionsData();

  const selectedSeason =
    seasons.find((season) => season.key === selectedSeasonKey) ??
    seasons.find((season) => season.isActive) ??
    seasons[0] ??
    null;

  return {
    seasons,
    selectedSeason,
  };
}

async function getPlannerEntries(args: {
  seasonKey?: string | null;
  rangeStart?: Date;
  rangeEnd?: Date;
}) {
  if (!args.seasonKey) {
    return [];
  }

  const entries = await prisma.event.findMany({
    where: {
      season: {
        key: args.seasonKey,
      },
      ...(args.rangeStart && args.rangeEnd
        ? {
            startAt: {
              gte: args.rangeStart,
              lte: args.rangeEnd,
            },
          }
        : {}),
    },
    orderBy: [{ startAt: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      source: true,
      startAt: true,
      endAt: true,
      location: true,
      description: true,
      websiteVisible: true,
      infoboardVisible: true,
      wochenplanVisible: true,
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  return entries.map<PlannerEntry>((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    typeLabel: getPlannerTypeLabel(entry.type),
    source: entry.source,
    sourceLabel: getPlannerSourceLabel(entry.source),
    startAt: entry.startAt,
    endAt: entry.endAt,
    location: entry.location,
    teamName: entry.team?.name ?? null,
    description: entry.description,
    websiteVisible: entry.websiteVisible,
    infoboardVisible: entry.infoboardVisible,
    wochenplanVisible: entry.wochenplanVisible,
  }));
}

export async function getPlannerCreateFormData(args?: {
  selectedSeasonKey?: string | null;
  selectedType?: string | null;
}) {
  const { seasons, selectedSeason } = await resolveSelectedSeason(
    args?.selectedSeasonKey,
  );

  const teams = await prisma.team.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
    },
  });

  const planningResources = await prisma.planningResource.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
    },
  });

  const normalizedType =
    args?.selectedType &&
    Object.values(EventType).includes(args.selectedType as EventType)
      ? (args.selectedType as EventType)
      : EventType.TRAINING;

  const selectedSeasonKey = selectedSeason?.key ?? "";
  const backHref = selectedSeasonKey
    ? `/dashboard/planner?season=${encodeURIComponent(selectedSeasonKey)}`
    : "/dashboard/planner";

  return {
    seasons: seasons.map((season) => ({
      id: season.id,
      key: season.key,
      name: season.name,
      isActive: season.isActive,
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      category: team.category,
    })),
    planningResources: planningResources.map((resource) => ({
      id: resource.id,
      key: resource.key,
      name: resource.name,
      type: resource.type,
    })),
    selectedSeasonKey,
    selectedSeasonId: selectedSeason?.id ?? "",
    selectedType: normalizedType,
    backHref,
  };
}

export async function getPlannerEditFormData(
  eventId: string,
  args?: {
    selectedType?: string | null;
  },
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      seasonId: true,
      type: true,
      source: true,
      title: true,
      description: true,
      location: true,
      startAt: true,
      endAt: true,
      opponentName: true,
      organizerName: true,
      competitionLabel: true,
      remarks: true,
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: true,
      wochenplanVisible: true,
      trainingsplanVisible: true,
      teamPageVisible: true,
      teamId: true,
      planningAllocations: {
        select: {
          resourceId: true,
          label: true,
          resource: {
            select: {
              type: true,
            },
          },
        },
      },
      season: {
        select: {
          key: true,
        },
      },
    },
  });

  if (!event) {
    return null;
  }

  const selectedType =
    args?.selectedType &&
    Object.values(EventType).includes(args.selectedType as EventType)
      ? (args.selectedType as EventType)
      : event.type;

  const base = await getPlannerCreateFormData({
    selectedSeasonKey: event.season.key,
    selectedType,
  });

  return {
    ...base,
    eventId: event.id,
    selectedSeasonId: event.seasonId,
    selectedSeasonKey: event.season.key,
    selectedType,
    defaults: {
      title: event.title,
      source: event.source,
      teamId: event.teamId ?? "",
      location: event.location ?? "",
      startAt: toDateTimeLocalValue(event.startAt),
      endAt: toDateTimeLocalValue(event.endAt),
      opponentName: event.opponentName ?? "",
      organizerName: event.organizerName ?? "",
      competitionLabel: event.competitionLabel ?? "",
      description: event.description ?? "",
      remarks: event.remarks ?? "",
      pitchResourceId:
        event.planningAllocations.find(
          (allocation) => allocation.resource.type === PlanningResourceType.PITCH,
        )?.resourceId ?? "",
      homeDressingRoomResourceId:
        event.planningAllocations.find(
          (allocation) =>
            allocation.resource.type === PlanningResourceType.DRESSING_ROOM &&
            allocation.label !== "Gegner",
        )?.resourceId ?? "",
      awayDressingRoomResourceId:
        event.planningAllocations.find(
          (allocation) =>
            allocation.resource.type === PlanningResourceType.DRESSING_ROOM &&
            allocation.label === "Gegner",
        )?.resourceId ?? "",
      websiteVisible: event.websiteVisible,
      infoboardVisible: event.infoboardVisible,
      homepageVisible: event.homepageVisible,
      wochenplanVisible: event.wochenplanVisible,
      trainingsplanVisible: event.trainingsplanVisible,
      teamPageVisible: event.teamPageVisible,
    },
  };
}

export async function getSeasonPlannerData(selectedSeasonKey?: string | null) {
  const { seasons, selectedSeason } = await resolveSelectedSeason(selectedSeasonKey);
  const entries = await getPlannerEntries({
    seasonKey: selectedSeason?.key,
  });

  const counts = {
    trainings: entries.filter((entry) => entry.type === "TRAINING").length,
    matches: entries.filter((entry) => entry.type === "MATCH").length,
    tournaments: entries.filter((entry) => entry.type === "TOURNAMENT").length,
    otherEvents: entries.filter((entry) => entry.type === "OTHER").length,
    vacationPeriods: entries.filter(
      (entry) => entry.type === "VACATION_PERIOD",
    ).length,
  };

  return {
    seasons,
    selectedSeason,
    entries,
    counts,
    latestEntries: [...entries]
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
      .slice(0, 8),
  };
}

export async function getWeekPlannerData(args: {
  selectedSeasonKey?: string | null;
  weekId?: string | null;
}) {
  const { seasons, selectedSeason } = await resolveSelectedSeason(
    args.selectedSeasonKey,
  );
  const week = getWeekWindow(args.weekId);
  const entries = await getPlannerEntries({
    seasonKey: selectedSeason?.key,
    rangeStart: week.start,
    rangeEnd: week.end,
  });

  return {
    seasons,
    selectedSeason,
    week,
    entries,
  };
}

export async function getDayPlannerData(args: {
  selectedSeasonKey?: string | null;
  day?: string | null;
}) {
  const { seasons, selectedSeason } = await resolveSelectedSeason(
    args.selectedSeasonKey,
  );
  const day = getDayWindow(args.day);
  const entries = await getPlannerEntries({
    seasonKey: selectedSeason?.key,
    rangeStart: day.start,
    rangeEnd: day.end,
  });

  return {
    seasons,
    selectedSeason,
    day,
    entries,
  };
}
