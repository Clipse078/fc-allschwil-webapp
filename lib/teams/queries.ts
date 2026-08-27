import { prisma } from "@/lib/db/prisma";
import { resolveLongTeamName, resolveCompactTeamName } from "@/lib/teams/team-naming";
import { currentTeamSeasonWhere, pickCurrentTeamSeason } from "@/lib/teams/current-season";
import { loadCurrentSeasonSfvMapping } from "@/lib/teams/team-cockpit-sporting-data";
import { resolveTeamCompetitionDisplay } from "@/lib/teams/team-competition-display";

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
  // TEAMCENTER-UX-01C: canonical current-season resolution — see
  // lib/teams/current-season.ts for why this must not be re-derived locally.
  const currentSeasonWhere = currentTeamSeasonWhere(selectedSeasonKey);

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
      infoboardDisplayName: true,
      infoboardTrainingDisplayName: true,
      infoboardMatchDisplayName: true,
      infoboardTournamentDisplayName: true,
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
      infoboardDisplayName: team.infoboardDisplayName,
      infoboardTrainingDisplayName: team.infoboardTrainingDisplayName,
      infoboardMatchDisplayName: team.infoboardMatchDisplayName,
      infoboardTournamentDisplayName: team.infoboardTournamentDisplayName,
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
      infoboardDisplayName: true,
      infoboardTrainingDisplayName: true,
      infoboardMatchDisplayName: true,
      infoboardTournamentDisplayName: true,
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
      // TEAM-COCKPIT-PREMIUM-01C: do not use team-level latest mapping for
      // competition resolution — current-season mapping is loaded after
      // pickCurrentTeamSeason via loadCurrentSeasonSfvMapping().
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
          // TEAM-SEASON-ORGUNIT-01: canonical season-scoped OrgUnit assignment.
          orgUnits: {
            where: { isPrimary: true },
            take: 1,
            select: {
              isPrimary: true,
              orgUnit: {
                select: {
                  id: true,
                  name: true,
                  key: true,
                  type: true,
                },
              },
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
                  dateOfBirth: true,
                },
              },
            },
          },
          trainerTeamMembers: {
            orderBy: [
              { sortOrder: "asc" },
              { person: { lastName: "asc" } },
              { person: { firstName: "asc" } },
            ],
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

  // TEAMCENTER-UX-01C: canonical current-season resolution, shared with
  // getTeamsListData. Deliberately does NOT fall back to
  // `team.teamSeasons[0]` — a Team with no TeamSeason in the canonical
  // current season has no current season, full stop. Falling back to
  // "whatever season this Team most recently started" is exactly what
  // made the Team detail page show a different "current" season than the
  // Teams list for the same Team.
  const activeSeasonEntry = pickCurrentTeamSeason(team.teamSeasons);
  const currentSeasonSfvMapping =
    activeSeasonEntry !== null
      ? await loadCurrentSeasonSfvMapping({
          tenantId,
          teamSeasonId: activeSeasonEntry.id,
          seasonKey: activeSeasonEntry.season.key,
        })
      : null;

  // TEAM-SFV-MAPPING-01 / TEAMCENTER-UX-01B: Liga/Wettbewerb for the Team
  // detail header/settings surface — sourced from the canonical
  // TeamSeasonCompetition -> Competition relation of the active season,
  // with resilient SFV providerLeagueName fallback when canonical data is absent.
  const primaryCompetition = activeSeasonEntry?.competitions[0]?.competition ?? null;
  const resolvedCompetitionDisplay = resolveTeamCompetitionDisplay({
    providerLeagueName: currentSeasonSfvMapping?.providerLeagueName,
    canonicalCompetition: primaryCompetition
      ? {
          name: primaryCompetition.officialName,
          shortName: primaryCompetition.shortName,
        }
      : null,
  });

  // TEAM-SEASON-ORGUNIT-01: canonical season-scoped OrgUnit for the current season.
  const currentSeasonOrgUnit = activeSeasonEntry?.orgUnits?.[0]?.orgUnit ?? null;

  // TEAM-IDENTITY-01: canonical naming contract — see lib/teams/team-naming.ts.
  const namingInput = {
    teamSeasonDisplayName: activeSeasonEntry?.displayName ?? null,
    teamName: team.name,
    teamShortName: team.shortName,
    teamAlternativeName: team.alternativeName,
    providerTeamName: currentSeasonSfvMapping?.providerTeamName ?? null,
  };

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    alternativeName: team.alternativeName,
    infoboardDisplayName: team.infoboardDisplayName,
    infoboardTrainingDisplayName: team.infoboardTrainingDisplayName,
    infoboardMatchDisplayName: team.infoboardMatchDisplayName,
    infoboardTournamentDisplayName: team.infoboardTournamentDisplayName,
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
    // TEAMCENTER-UX-01C: the canonical current-season TeamSeason's id (or
    // null when this Team has none). Callers must look this id up in
    // `teamSeasons` rather than re-deriving "which season is current"
    // themselves — see lib/teams/current-season.ts.
    currentTeamSeasonId: activeSeasonEntry?.id ?? null,
    // TEAMCENTER-UX-01C: current season's participation type, exposed so the
    // edit UI can gate competition assignment the same way registration does
    // (see lib/teams/team-season-service.ts#setTeamSeasonCompetition) — a
    // TRAINING/DEVELOPMENT/... TeamSeason must not be offered a competition
    // picker that silently no-ops or 400s on save.
    currentParticipationType: activeSeasonEntry?.participationType ?? null,
    // TEAM-SEASON-ORGUNIT-01: primary OrgUnit for the current season.
    currentSeasonOrgUnit: currentSeasonOrgUnit
      ? { id: currentSeasonOrgUnit.id, name: currentSeasonOrgUnit.name, key: currentSeasonOrgUnit.key, type: currentSeasonOrgUnit.type }
      : null,
    competition: resolvedCompetitionDisplay
      ? {
          id:
            resolvedCompetitionDisplay.source === "CANONICAL_COMPETITION"
              ? primaryCompetition?.id ?? null
              : null,
          name: resolvedCompetitionDisplay.name,
          shortName: resolvedCompetitionDisplay.shortName ?? null,
          source: resolvedCompetitionDisplay.source,
        }
      : null,
    currentSeasonSfvMapping: currentSeasonSfvMapping
      ? {
          externalTeamId: currentSeasonSfvMapping.externalTeamId,
          externalSeasonId: currentSeasonSfvMapping.externalSeasonId,
          providerLeagueId: currentSeasonSfvMapping.providerLeagueId,
          providerLeagueName: currentSeasonSfvMapping.providerLeagueName,
        }
      : null,
    providerMapping: currentSeasonSfvMapping
      ? {
          provider: "SFV",
          teamName: currentSeasonSfvMapping.providerTeamName,
          isActive: true,
          lastSyncedAt: currentSeasonSfvMapping.lastSyncedAt.toISOString(),
        }
      : null,
    teamSeasons: team.teamSeasons.map((entry) => ({
      ...entry,
      season: {
        ...entry.season,
        startDate: entry.season.startDate.toISOString(),
        endDate: entry.season.endDate.toISOString(),
      },
      playerSquadMembers: (entry.playerSquadMembers ?? []).map((member) => ({
        ...member,
        person: {
          ...member.person,
          dateOfBirth: member.person.dateOfBirth?.toISOString() ?? null,
        },
      })),
      trainerTeamMembers: entry.trainerTeamMembers ?? [],
    })),
  };
}

// Export type alias so callers can use it without importing Prisma directly.
export type TeamDetailData = NonNullable<Awaited<ReturnType<typeof getTeamDetailData>>>;
