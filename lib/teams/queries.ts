import { prisma } from "@/lib/db/prisma";
import { getCurrentSwissFootballSeason } from "@/lib/seasons/season-logic";
import { resolveLongTeamName, resolveCompactTeamName } from "@/lib/teams/team-naming";

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

/**
 * Returns the tenant-scoped Teams list for the dashboard overview.
 *
 * tenantId is required and always sourced from the trusted server-side
 * session/tenant context (never from client input) — see callers in
 * app/(admin)/dashboard/teams/page.tsx and app/api/teams/route.ts.
 */
export async function getTeamsListData(tenantId: string, selectedSeasonKey?: string) {
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
    where: { tenantId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
      // Never written by provider sync — see lib/teams/team-naming.ts.
      shortName: true,
      alternativeName: true,
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
          // TEAM-SFV-MAPPING-01: surface the competition/league on the teams
          // list so rows that otherwise share a generic display name (e.g.
          // multiple provider-imported "FC Allschwil" rows) remain
          // distinguishable without opening each team.
          competitions: {
            where: { isPrimary: true },
            take: 1,
            select: {
              competition: {
                select: {
                  officialName: true,
                  shortName: true,
                },
              },
            },
          },
        },
      },
      // TEAM-SFV-MAPPING-01: provider mapping / sync status for recognition.
      // A Team may carry mapping rows from several historical seasons (one
      // per season it was synced) — the most recently synced row reflects
      // current provider status.
      externalMappings: {
        orderBy: { lastSyncedAt: "desc" },
        take: 1,
        select: {
          provider: true,
          providerIsActive: true,
          lastSyncedAt: true,
          mappingSource: true,
          // TEAM-IDENTITY-01: provider-owned display name, used only as the
          // final fallback in the canonical naming contract (lib/teams/team-naming.ts).
          providerTeamName: true,
        },
      },
    },
  });

  return teams.map((team) => {
    const activeSeasonEntry = team.teamSeasons[0] ?? null;
    const primaryCompetition = activeSeasonEntry?.competitions[0]?.competition ?? null;
    const latestMapping = team.externalMappings[0] ?? null;

    // TEAM-IDENTITY-01: canonical naming contract — see lib/teams/team-naming.ts.
    const namingInput = {
      teamSeasonDisplayName: activeSeasonEntry?.displayName ?? null,
      teamName: team.name,
      teamShortName: team.shortName,
      teamAlternativeName: team.alternativeName,
      providerTeamName: latestMapping?.providerTeamName ?? null,
    };

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      alternativeName: team.alternativeName,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      sortOrder: team.sortOrder,
      isActive: team.isActive,
      websiteVisible: team.websiteVisible,
      infoboardVisible: team.infoboardVisible,
      displayName: resolveLongTeamName(namingInput),
      compactName: resolveCompactTeamName(namingInput),
      activeSeason: activeSeasonEntry
        ? {
            seasonKey: activeSeasonEntry.season.key,
            seasonName: activeSeasonEntry.season.name,
            displayName: activeSeasonEntry.displayName,
            shortName: activeSeasonEntry.shortName,
            status: activeSeasonEntry.status,
          }
        : null,
      competition: primaryCompetition
        ? {
            name: primaryCompetition.officialName,
            shortName: primaryCompetition.shortName,
          }
        : null,
      providerMapping: latestMapping
        ? {
            provider: latestMapping.provider,
            isActive: latestMapping.providerIsActive,
            lastSyncedAt: latestMapping.lastSyncedAt.toISOString(),
            source: latestMapping.mappingSource,
            teamName: latestMapping.providerTeamName,
          }
        : null,
    };
  });
}

/**
 * Returns full detail data for a single Team, strictly scoped to tenantId.
 *
 * tenantId is required for tenant isolation. A teamId belonging to a different
 * tenant returns null — the caller must call notFound() in that case.
 *
 * Legacy Team rows where tenantId is null in the DB are excluded when queried
 * through this function. If cross-tenant system access is needed, use a
 * separately authorized internal function.
 */
export async function getTeamDetailData(tenantId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: {
      id: true,
      name: true,
      // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
      // Never written by provider sync — see lib/teams/team-naming.ts.
      shortName: true,
      alternativeName: true,
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
      // TEAM-IDENTITY-01: read-only provider identity/name for display.
      // Never edited here — provider mapping ownership lives in
      // lib/integrations/sfv/sync/* and the provider-mapping workflow.
      externalMappings: {
        orderBy: { lastSyncedAt: "desc" },
        take: 1,
        select: {
          provider: true,
          providerTeamName: true,
          providerIsActive: true,
          externalTeamId: true,
          lastSyncedAt: true,
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

  const activeSeasonEntry =
    team.teamSeasons.find((entry) => entry.season.isActive) ??
    team.teamSeasons[0] ??
    null;
  const latestMapping = team.externalMappings?.[0] ?? null;

  // TEAM-IDENTITY-01: canonical naming contract — see lib/teams/team-naming.ts.
  const namingInput = {
    teamSeasonDisplayName: activeSeasonEntry?.displayName ?? null,
    teamName: team.name,
    teamShortName: team.shortName,
    teamAlternativeName: team.alternativeName,
    providerTeamName: latestMapping?.providerTeamName ?? null,
  };

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    alternativeName: team.alternativeName,
    slug: team.slug,
    category: team.category,
    genderGroup: team.genderGroup,
    ageGroup: team.ageGroup,
    sortOrder: team.sortOrder,
    isActive: team.isActive,
    websiteVisible: team.websiteVisible,
    infoboardVisible: team.infoboardVisible,
    orgUnitId: team.orgUnitId,
    orgUnit: team.orgUnit,
    displayName: resolveLongTeamName(namingInput),
    compactName: resolveCompactTeamName(namingInput),
    providerMapping: latestMapping
      ? {
          provider: latestMapping.provider,
          teamName: latestMapping.providerTeamName,
          isActive: latestMapping.providerIsActive,
          lastSyncedAt: latestMapping.lastSyncedAt.toISOString(),
        }
      : null,
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
