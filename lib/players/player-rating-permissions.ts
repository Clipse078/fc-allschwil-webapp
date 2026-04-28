import { prisma } from "@/lib/db/prisma";

type CanRatePlayerArgs = {
  userId: string | null | undefined;
  personId: string;
  seasonId: string;
};

type RatingPermissionReasonArgs = CanRatePlayerArgs;

const ADMIN_ROLE_KEYS = new Set(["ADMIN", "SUPERADMIN"]);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getPlayerRatingPermissionReasons({
  userId,
  personId,
  seasonId,
}: RatingPermissionReasonArgs) {
  if (!userId || !personId || !seasonId) {
    return {
      canRate: false,
      reasons: ["Nur Leserechte"],
    };
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
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return {
      canRate: false,
      reasons: ["Benutzer nicht aktiv"],
    };
  }

  const roleKeys = user.userRoles.map((entry) => entry.role.key);
  const roleIds = user.userRoles.map((entry) => entry.roleId);

  if (roleKeys.some((key) => ADMIN_ROLE_KEYS.has(key))) {
    return {
      canRate: true,
      reasons: ["Admin/Superadmin"],
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
  });

  const teamSeasonIds = playerTeamSeasons.map((entry) => entry.teamSeasonId);

  if (teamSeasonIds.length === 0) {
    return {
      canRate: false,
      reasons: ["Keine Team-Saison-Zuordnung"],
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
    select: {
      id: true,
      roleId: true,
      includeTeamTrainers: true,
      teamSeasonId: true,
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
  });

  if (permissions.length === 0) {
    return {
      canRate: false,
      reasons: ["Keine zusätzliche Freigabe"],
    };
  }

  const reasons: string[] = [];

  for (const permission of permissions) {
    const target =
      permission.teamSeason.shortName ??
      permission.teamSeason.displayName ??
      permission.teamSeason.team.name;

    if (permission.roleId && roleIds.includes(permission.roleId)) {
      reasons.push(`Rolle: ${permission.role?.name ?? "Freigegebene Rolle"} (${target})`);
    }
  }

  const trainerPermissionTeamSeasonIds = permissions
    .filter((permission) => permission.includeTeamTrainers)
    .map((permission) => permission.teamSeasonId);

  if (user.personId && trainerPermissionTeamSeasonIds.length > 0) {
    const trainerAssignments = await prisma.trainerTeamMember.findMany({
      where: {
        personId: user.personId,
        status: "ACTIVE",
        teamSeasonId: {
          in: trainerPermissionTeamSeasonIds,
        },
      },
      select: {
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
    });

    for (const assignment of trainerAssignments) {
      const target =
        assignment.teamSeason.shortName ??
        assignment.teamSeason.displayName ??
        assignment.teamSeason.team.name;

      reasons.push(`Trainerteam: ${target}`);
    }
  }

  const finalReasons = unique(reasons);

  return {
    canRate: finalReasons.length > 0,
    reasons: finalReasons.length > 0 ? finalReasons : ["Keine passende Freigabe"],
  };
}

export async function canRatePlayerForSeason(args: CanRatePlayerArgs) {
  const result = await getPlayerRatingPermissionReasons(args);
  return result.canRate;
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
