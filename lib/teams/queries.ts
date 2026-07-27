import { prisma } from "@/lib/db/prisma";
import { getCurrentSwissFootballSeason } from "@/lib/seasons/season-logic";

export async function getAvailableTeamSeasons() {
  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }, { name: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  return seasons;
}

export async function getTeamsListData(selectedSeasonKey?: string) {
  const currentSeason = getCurrentSwissFootballSeason();

  const resolvedSeasonKey =
    selectedSeasonKey && selectedSeasonKey.trim().length > 0
      ? selectedSeasonKey
      : currentSeason?.key ?? null;

  const currentSeasonWhere = resolvedSeasonKey
    ? {
        season: {
          key: resolvedSeasonKey,
        },
      }
    : {
        season: {
          isActive: true,
        },
      };

  const teams = await prisma.team.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      sortOrder: true,
      isActive: true,
      websiteVisible: true,
      infoboardVisible: true,
      teamSeasons: {
        where: currentSeasonWhere,
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          season: {
            select: {
              key: true,
              name: true,
            },
          },
          displayName: true,
          shortName: true,
          status: true,
        },
      },
    },
  });

  return teams.map((team) => {
    const activeSeasonEntry = team.teamSeasons[0] ?? null;

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      sortOrder: team.sortOrder,
      isActive: team.isActive,
      websiteVisible: team.websiteVisible,
      infoboardVisible: team.infoboardVisible,
      activeSeason: activeSeasonEntry
        ? {
            seasonKey: activeSeasonEntry.season.key,
            seasonName: activeSeasonEntry.season.name,
            displayName: activeSeasonEntry.displayName,
            shortName: activeSeasonEntry.shortName,
            status: activeSeasonEntry.status,
          }
        : null,
    };
  });
}

/**
 * Returns full detail data for a single Team, scoped to the given tenantId.
 *
 * tenantId is required for tenant isolation: a teamId from a foreign tenant
 * returns null (treated as notFound by the caller). Nullable legacy Team rows
 * that pre-date tenant isolation are only visible when tenantId is undefined,
 * which should not happen from authenticated server components.
 */
export async function getTeamDetailData(teamId: string, tenantId?: string | null) {
  const where = tenantId
    ? { id: teamId, tenantId }
    : { id: teamId };

  const team = await prisma.team.findFirst({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      sortOrder: true,
      isActive: true,
      websiteVisible: true,
      infoboardVisible: true,
      orgUnitId: true,
      orgUnit: {
        select: {
          id: true,
          name: true,
          key: true,
          type: true,
        },
      },
      teamSeasons: {
        orderBy: {
          season: {
            startDate: "desc",
          },
        },
        select: {
          id: true,
          displayName: true,
          shortName: true,
          status: true,
          participationType: true,
          websiteVisible: true,
          infoboardVisible: true,
          season: {
            select: {
              id: true,
              key: true,
              name: true,
              startDate: true,
              endDate: true,
              isActive: true,
            },
          },
          competitions: {
            where: { isPrimary: true },
            take: 1,
            select: {
              isPrimary: true,
              competition: {
                select: {
                  id: true,
                  officialName: true,
                  shortName: true,
                  provider: true,
                  competitionType: true,
                  isArchived: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!team) {
    return null;
  }

  return {
    ...team,
    teamSeasons: team.teamSeasons.map((entry) => ({
      ...entry,
      season: {
        ...entry.season,
        startDate: entry.season.startDate.toISOString(),
        endDate: entry.season.endDate.toISOString(),
      },
    })),
  };
}

// Export type alias so callers can use it without importing Prisma directly.
export type TeamDetailData = NonNullable<Awaited<ReturnType<typeof getTeamDetailData>>>;
