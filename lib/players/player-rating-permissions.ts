import { prisma } from "@/lib/db/prisma";

type CanRatePlayerArgs = {
  userId: string | null | undefined;
  personId: string;
  seasonId: string;
};

const ADMIN_ROLE_KEYS = new Set(["ADMIN", "SUPERADMIN"]);

export async function canRatePlayerForSeason({
  userId,
  personId,
  seasonId,
}: CanRatePlayerArgs) {
  if (!userId || !personId || !seasonId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      personId: true,
      isActive: true,
      userRoles: {
        select: {
          roleId: true,
          role: {
            select: {
              key: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return false;
  }

  const roleKeys = user.userRoles.map((entry) => entry.role.key);
  const roleIds = user.userRoles.map((entry) => entry.roleId);

  if (roleKeys.some((key) => ADMIN_ROLE_KEYS.has(key))) {
    return true;
  }

  const playerTeamSeasons = await prisma.playerSquadMember.findMany({
    where: {
      personId,
      teamSeason: {
        seasonId,
      },
    },
    select: {
      teamSeasonId: true,
    },
  });

  const teamSeasonIds = playerTeamSeasons.map((entry) => entry.teamSeasonId);

  if (teamSeasonIds.length === 0) {
    return false;
  }

  const permissions = await prisma.playerRatingPermission.findMany({
    where: {
      isActive: true,
      seasonId,
      teamSeasonId: {
        in: teamSeasonIds,
      },
    },
    select: {
      id: true,
      roleId: true,
      includeTeamTrainers: true,
      teamSeasonId: true,
    },
  });

  if (permissions.length === 0) {
    return false;
  }

  const hasRolePermission = permissions.some(
    (permission) => permission.roleId && roleIds.includes(permission.roleId),
  );

  if (hasRolePermission) {
    return true;
  }

  const trainerPermissionTeamSeasonIds = permissions
    .filter((permission) => permission.includeTeamTrainers)
    .map((permission) => permission.teamSeasonId);

  if (!user.personId || trainerPermissionTeamSeasonIds.length === 0) {
    return false;
  }

  const trainerAssignment = await prisma.trainerTeamMember.findFirst({
    where: {
      personId: user.personId,
      status: "ACTIVE",
      teamSeasonId: {
        in: trainerPermissionTeamSeasonIds,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(trainerAssignment);
}

export async function getRatingPermissionSummaryForPlayer({
  personId,
  seasonId,
}: {
  personId: string;
  seasonId: string | null | undefined;
}) {
  if (!personId || !seasonId) {
    return {
      canBeRatedByConfiguredUsers: false,
      labels: ["Admin"],
    };
  }

  const playerTeamSeasons = await prisma.playerSquadMember.findMany({
    where: {
      personId,
      teamSeason: {
        seasonId,
      },
    },
    select: {
      teamSeasonId: true,
    },
  });

  const teamSeasonIds = playerTeamSeasons.map((entry) => entry.teamSeasonId);

  if (teamSeasonIds.length === 0) {
    return {
      canBeRatedByConfiguredUsers: false,
      labels: ["Admin", "Keine Team-Saison-Zuordnung"],
    };
  }

  const permissions = await prisma.playerRatingPermission.findMany({
    where: {
      isActive: true,
      seasonId,
      teamSeasonId: {
        in: teamSeasonIds,
      },
    },
    include: {
      role: {
        select: {
          name: true,
        },
      },
      teamSeason: {
        select: {
          shortName: true,
          displayName: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const labels = [
    "Admin",
    ...permissions.map((permission) => {
      const target =
        permission.teamSeason.shortName ??
        permission.teamSeason.displayName ??
        permission.teamSeason.team.name;

      if (permission.includeTeamTrainers) {
        return `${target}: Trainerteam`;
      }

      if (permission.role) {
        return `${target}: ${permission.role.name}`;
      }

      return `${target}: Zusatzregel`;
    }),
  ];

  return {
    canBeRatedByConfiguredUsers: permissions.length > 0,
    labels,
  };
}
