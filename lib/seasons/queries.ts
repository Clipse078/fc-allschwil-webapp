import { prisma } from "@/lib/db/prisma";
import {
  getCurrentSwissFootballSeason,
  getNextSwissFootballSeason,
  getSeasonLifecycleStatus,
} from "@/lib/seasons/season-logic";
import { getSeasonLifecycleStatusLabel } from "@/lib/seasons/status";

async function syncSeasonActiveFlagsWithLifecycle() {
  const seasons = await prisma.season.findMany({
    select: {
      id: true,
      startDate: true,
      endDate: true,
      isActive: true,
    },
  });

  if (seasons.length === 0) {
    return;
  }

  const ongoingSeasonIds = seasons
    .filter((season) => {
      const lifecycleStatus = getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      });

      return lifecycleStatus === "ONGOING";
    })
    .map((season) => season.id);

  await prisma.$transaction([
    prisma.season.updateMany({
      data: {
        isActive: false,
      },
    }),
    ...(ongoingSeasonIds.length > 0
      ? [
          prisma.season.updateMany({
            where: {
              id: {
                in: ongoingSeasonIds,
              },
            },
            data: {
              isActive: true,
            },
          }),
        ]
      : []),
  ]);
}

export async function getSeasonOptionsData() {
  await syncSeasonActiveFlagsWithLifecycle();

  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  return seasons.map((season) => {
    const lifecycleStatus =
      getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      }) ?? "PLANNING";

    return {
      ...season,
      lifecycleStatus,
      lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
      shouldBeActive: lifecycleStatus === "ONGOING",
    };
  });
}

export async function getCurrentSeasonOptionData() {
  await syncSeasonActiveFlagsWithLifecycle();

  const current = getCurrentSwissFootballSeason();

  if (!current) {
    return null;
  }

  const season = await prisma.season.findFirst({
    where: {
      key: current.key,
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!season) {
    return null;
  }

  const lifecycleStatus =
    getSeasonLifecycleStatus({
      startDate: season.startDate,
      endDate: season.endDate,
    }) ?? "PLANNING";

  return {
    ...season,
    lifecycleStatus,
    lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
    shouldBeActive: lifecycleStatus === "ONGOING",
  };
}

export async function getNextSeasonOptionData() {
  await syncSeasonActiveFlagsWithLifecycle();

  const next = getNextSwissFootballSeason();

  if (!next) {
    return null;
  }

  const season = await prisma.season.findFirst({
    where: {
      key: next.key,
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!season) {
    return null;
  }

  const lifecycleStatus =
    getSeasonLifecycleStatus({
      startDate: season.startDate,
      endDate: season.endDate,
    }) ?? "PLANNING";

  return {
    ...season,
    lifecycleStatus,
    lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
    shouldBeActive: lifecycleStatus === "ONGOING",
  };
}

export async function getSeasonsOverviewData() {
  await syncSeasonActiveFlagsWithLifecycle();

  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
      _count: {
        select: {
          teamSeasons: true,
          events: true,
        },
      },
    },
  });

  return seasons.map((season) => {
    const lifecycleStatus =
      getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      }) ?? "PLANNING";

    return {
      id: season.id,
      key: season.key,
      name: season.name,
      isActive: season.isActive,
      startDate: season.startDate,
      endDate: season.endDate,
      lifecycleStatus,
      lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
      shouldBeActive: lifecycleStatus === "ONGOING",
      teamSeasonCount: season._count.teamSeasons,
      eventCount: season._count.events,
    };
  });
}
