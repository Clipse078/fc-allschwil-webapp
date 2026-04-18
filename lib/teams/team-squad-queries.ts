import { prisma } from "@/lib/db/prisma";

export async function getTeamSeasonSquadData(teamSeasonId: string) {
  return prisma.playerSquadMember.findMany({
    where: {
      teamSeasonId,
    },
    orderBy: [
      { sortOrder: "asc" },
      { shirtNumber: "asc" },
      { person: { lastName: "asc" } },
      { person: { firstName: "asc" } },
    ],
    select: {
      id: true,
      teamSeasonId: true,
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
        },
      },
    },
  });
}

export async function getTeamSquadOverviewData(teamId: string) {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: {
      teamId,
    },
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
      squadWebsiteVisible: true,
      trainerTeamWebsiteVisible: true,
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
        orderBy: [
          { sortOrder: "asc" },
          { shirtNumber: "asc" },
          { person: { lastName: "asc" } },
          { person: { firstName: "asc" } },
        ],
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
            },
          },
        },
      },
    },
  });

  return teamSeasons;
}
