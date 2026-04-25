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

export async function getTeamDetailData(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
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
          playerSquadMembers: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              status: true,
              shirtNumber: true,
              positionLabel: true,
              isCaptain: true,
              isViceCaptain: true,
              isWebsiteVisible: true,
              sortOrder: true,
              remarks: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  email: true,
                  phone: true,
                  dateOfBirth: true,
                },
              },
            },
          },
          trainerTeamMembers: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              status: true,
              roleLabel: true,
              isWebsiteVisible: true,
              sortOrder: true,
              remarks: true,
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  email: true,
                  phone: true,
                  trainerQualifications: {
                    orderBy: [{ expiresAt: "asc" }, { title: "asc" }],
                    select: {
                      id: true,
                      type: true,
                      status: true,
                      title: true,
                      issuer: true,
                      issuedAt: true,
                      expiresAt: true,
                      licenseNumber: true,
                      remarks: true,
                      isClubVerified: true,
                    },
                  },
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
      playerSquadMembers: entry.playerSquadMembers.map((member) => ({
        ...member,
        person: {
          ...member.person,
          dateOfBirth: member.person.dateOfBirth?.toISOString() ?? null,
        },
      })),
      trainerTeamMembers: entry.trainerTeamMembers.map((member) => ({
        ...member,
        person: {
          ...member.person,
          trainerQualifications: member.person.trainerQualifications.map((qualification) => ({
            ...qualification,
            issuedAt: qualification.issuedAt?.toISOString() ?? null,
            expiresAt: qualification.expiresAt?.toISOString() ?? null,
          })),
        },
      })),
    })),
  };
}
