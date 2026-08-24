import { prisma } from "@/lib/db/prisma";

export async function assertTeamSeasonAccess(
  teamId: string,
  teamSeasonId: string,
  tenantId: string,
) {
  const teamSeason = await prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      teamId,
      team: { tenantId },
    },
    select: {
      id: true,
      teamId: true,
      team: {
        select: {
          tenantId: true,
        },
      },
    },
  });

  if (!teamSeason || !teamSeason.team.tenantId) {
    return null;
  }

  return teamSeason;
}
