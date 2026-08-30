/**
 * lib/website/public-teams-feed.ts
 *
 * Public teams queries for:
 *   GET /api/public/[tenant]/website/teams         → getPublicTeams()
 *   GET /api/public/[tenant]/website/teams/[slug]  → getPublicTeamDetail()
 *
 * Tenant isolation is enforced at the DB level via Team.tenantId
 * (migration: 20260626000000_team_tenant_isolation).
 *
 * Design invariants:
 * - Only active and website-visible teams for the given tenant are returned.
 * - Private/admin-only fields are never returned: personId, email, phone,
 *   dateOfBirth, remarks, isActive, websiteVisible, infoboardVisible,
 *   orgUnitId, sortOrder, tenantId, createdAt, updatedAt.
 * - displayName falls back to team.name when no active TeamSeason is found.
 * - Season is resolved by active season flag when seasonKey is not supplied.
 * - Squad/trainer visibility is gated by TeamSeason.squadWebsiteVisible /
 *   TeamSeason.trainerTeamWebsiteVisible.
 * - pitchCode (internal allocation code) is resolved to pitchName via
 *   FacilityResource but the raw code is never exposed publicly.
 */

import { prisma } from "@/lib/db/prisma";
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";
import { listTeamSeasonMatches, type TeamMatchQueryDatabase } from "@/lib/teams/team-match-query-service";
import { findNextTournamentEventForTeamSeason } from "@/lib/tournaments/queries";
import { listTournamentsByIds } from "@/lib/tournaments/tournament-service";
import {
  buildStandingsClubEnrichmentByProviderTeamId,
} from "@/lib/club-directory/standings-club-enrichment";
import {
  collectProviderClubIdsFromExternalTeams,
  loadCanonicalClubLogoIndex,
  resolveExternalTeamLogoWithCanonicalFallback,
  CANONICAL_EXTERNAL_TEAM_PROVIDER_MAPPING_SELECT,
} from "@/lib/club-directory/canonical-logo-resolution";
import { fetchTeamStandingsForMapping } from "@/lib/integrations/sfv/standings-provider";
import {
  getSeasonKeyLookupCandidatesFromSfvExternalSeasonId,
  SFV_PROVIDER,
} from "@/lib/integrations/sfv/season-bridge";
import {
  mapPublicTeamMatches,
  mapPublicTeamResults,
  type PublicTeamMatchExternalTeamRecord,
  type PublicTeamMatchIdentityContext,
  type PublicTeamMatchTeamRecord,
} from "@/lib/website/public-team-matches-mapper";
import {
  mapPublicTeamStandings,
  type PublicTeamStandingsExternalTeamRecord,
  type PublicTeamStandingsIdentityContext,
} from "@/lib/website/public-team-standings-mapper";
import { resolvePublicTeamNextEvent } from "@/lib/website/public-team-next-event";
import { toPublicWebsiteTournamentFromDto } from "@/lib/website/public-tournaments-mapper";
import type {
  PublicTeamListItem,
  PublicTeamOrgUnit,
  PublicTeamDetail,
  PublicSquadMember,
  PublicTrainerMember,
  PublicTeamTrainingSession,
  PublicTeamMatch,
  PublicTeamStandings,
  PublicTeamPublication,
  PublicWebsiteTournamentItem,
} from "@/lib/website/types";

// ---------------------------------------------------------------------------
// Local types matching the Prisma select shape
// ---------------------------------------------------------------------------

type OrgUnitRow = {
  isPrimary: boolean;
  displayOrder: number;
  orgUnit: {
    id: string;
    name: string;
    key: string;
    sortOrder: number;
  };
};

type TeamSeasonRow = {
  displayName: string;
  shortName: string | null;
  season: { key: string; name: string };
  orgUnits: OrgUnitRow[];
};

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  teamSeasons: TeamSeasonRow[];
};

export type GetPublicTeamsInput = {
  /** Required: DB-level tenant isolation via Team.tenantId. */
  tenantId: string;
  seasonKey?: string | null;
};

/**
 * Returns website-visible active teams for the given tenant with their
 * active-season display names and canonical OrgUnit grouping.
 *
 * Active-season enforcement: only teams with a TeamSeason in the canonical
 * active season are returned. Teams belonging exclusively to historical/inactive
 * seasons are excluded from the public teams directory.
 *
 * OrgUnit grouping: the primary OrgUnit (TeamSeasonOrgUnit.isPrimary = true)
 * for the active season is included in the response. FCA website consumers must
 * group/filter by `orgUnit.name` and `orgUnit.key` — not by the deprecated
 * `category` enum.
 *
 * Results are sorted in application code after fetching:
 *   1. OrgUnit.sortOrder (primary OrgUnit ascending; teams with no OrgUnit last)
 *   2. Team.sortOrder ascending
 *   3. Team.name ascending
 */
export async function getPublicTeams(
  input: GetPublicTeamsInput,
): Promise<PublicTeamListItem[]> {
  // TEAMCENTER-UX-01C: canonical current-season resolution — see
  // lib/teams/current-season.ts. Keeps the public website consistent with
  // the admin Teams UI/TrainingCenter for the same Team.
  const seasonWhere = currentTeamSeasonWhere(input.seasonKey);

  // Active-season filter: `some: seasonWhere` ensures only teams with a
  // TeamSeason in the canonical active season are included. Teams that exist
  // only in historical seasons are excluded from the public directory.
  const teams = await prisma.team.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      websiteVisible: true,
      teamSeasons: { some: seasonWhere },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      sortOrder: true,
      teamSeasons: {
        where: seasonWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          displayName: true,
          shortName: true,
          season: { select: { key: true, name: true } },
          // TEAM-CORE-02: canonical OrgUnit grouping via TeamSeasonOrgUnit
          orgUnits: {
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
            take: 1,
            select: {
              isPrimary: true,
              displayOrder: true,
              orgUnit: {
                select: {
                  id: true,
                  name: true,
                  key: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const mapped = (teams as (TeamRow & { sortOrder: number })[]).map((team) => {
    const activeSeason = team.teamSeasons[0] ?? null;
    const primaryOrgUnitLink = activeSeason?.orgUnits[0] ?? null;

    const orgUnit: PublicTeamOrgUnit | null = primaryOrgUnitLink
      ? {
          id: primaryOrgUnitLink.orgUnit.id,
          name: primaryOrgUnitLink.orgUnit.name,
          key: primaryOrgUnitLink.orgUnit.key,
          sortOrder: primaryOrgUnitLink.orgUnit.sortOrder,
          isPrimary: primaryOrgUnitLink.isPrimary,
        }
      : null;

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      displayName: activeSeason?.displayName ?? team.name,
      shortName: activeSeason?.shortName ?? null,
      season: activeSeason?.season ?? null,
      orgUnit,
      // Keep _sortKey for application-level secondary sort; dropped before return
      _orgUnitSortOrder: orgUnit?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      _teamSortOrder: team.sortOrder,
    };
  });

  // Sort by OrgUnit.sortOrder (canonical grouping order), then team.sortOrder, then name
  mapped.sort((a, b) => {
    if (a._orgUnitSortOrder !== b._orgUnitSortOrder) {
      return a._orgUnitSortOrder - b._orgUnitSortOrder;
    }
    if (a._teamSortOrder !== b._teamSortOrder) {
      return a._teamSortOrder - b._teamSortOrder;
    }
    return a.name.localeCompare(b.name, "de");
  });

  return mapped.map(
    ({ _orgUnitSortOrder: _o, _teamSortOrder: _t, ...item }) => {
      void _o;
      void _t;
      return item;
    },
  );
}

// ---------------------------------------------------------------------------
// Team detail query — used by GET /api/public/[tenant]/website/teams/[slug]
// ---------------------------------------------------------------------------

export type GetPublicTeamDetailInput = {
  /** Required: DB-level tenant isolation via Team.tenantId. */
  tenantId: string;
  /** URL-safe team slug, e.g. "e4". */
  slug: string;
  seasonKey?: string | null;
};

/**
 * Returns a fully hydrated public team detail including squad, trainer staff,
 * and upcoming training sessions. Returns null when no matching team exists
 * for the given tenant (caller MUST return 404).
 *
 * Two-phase query design — DB-level enforcement at both visibility layers:
 *
 *   Phase 1 — Team + TeamSeason metadata only (no member rows).
 *              Filters: Team.tenantId, Team.isActive, Team.websiteVisible,
 *                       TeamSeason.status = ACTIVE, TeamSeason.websiteVisible.
 *
 *   Phase 2a — Squad (PlayerSquadMember).
 *              Executed ONLY when TeamSeason.squadWebsiteVisible = true.
 *              When false: zero DB round-trips, zero rows loaded.
 *              Filters: teamSeasonId, status = ACTIVE, isWebsiteVisible = true.
 *
 *   Phase 2b — Trainer staff (TrainerTeamMember).
 *              Executed ONLY when TeamSeason.trainerTeamWebsiteVisible = true.
 *              When false: zero DB round-trips, zero rows loaded.
 *              Filters: teamSeasonId, status = ACTIVE, isWebsiteVisible = true.
 *
 *   Phase 3  — Upcoming TRAINING events (next 28 days).
 *              Filters: teamId, tenantId, type = TRAINING, websiteVisible = true,
 *                       status not CANCELLED/ARCHIVED, startAt in window.
 *
 *   Phase 4  — Upcoming MATCH fixtures for the current team season.
 *              Uses listTeamSeasonMatches() for canonical home/away participation.
 *              Publication gate: websiteVisible = true only (NOT teamPageVisible,
 *              which defaults false for SFV imports and has no active workflow).
 *              Public upcoming semantics and a 5-fixture limit are applied in
 *              lib/website/public-team-matches-mapper.ts.
 *
 *   Phase 5  — Recent completed MATCH results for the current team season.
 *              Uses the same listTeamSeasonMatches() canonical query as Phase 4.
 *              Publication gate: websiteVisible = true only.
 *              Public completed-result semantics and a 5-result limit are applied
 *              in lib/website/public-team-matches-mapper.ts.
 *
 *   Phase 6  — Current-season league standings (best-effort).
 *              Requires an SFV TeamExternalMapping for the resolved TeamSeason.
 *              Provider failures return standings: null without failing the endpoint.
 *
 * Privacy guarantees:
 * - personId, email, phone, dateOfBirth, remarks: never selected.
 * - pitchCode: selected internally for name resolution, never returned.
 * - Hidden members (isWebsiteVisible = false): excluded by DB WHERE — never loaded.
 * - Season-hidden squad (squadWebsiteVisible = false): query skipped entirely.
 * - Season-hidden trainers (trainerTeamWebsiteVisible = false): query skipped entirely.
 */
export async function getPublicTeamDetail(
  input: GetPublicTeamDetailInput,
): Promise<PublicTeamDetail | null> {
  // TEAMCENTER-UX-01C: canonical current-season resolution — see
  // lib/teams/current-season.ts.
  const seasonWhere = currentTeamSeasonWhere(input.seasonKey);

  // ── Phase 1: Team + TeamSeason metadata ─────────────────────────────────
  // Member relations (playerSquadMembers / trainerTeamMembers) are intentionally
  // NOT fetched here. They are conditionally loaded in Phase 2 based on the
  // TeamSeason visibility flags, ensuring zero records leave the DB when the
  // season-level flag is false.
  const team = await prisma.team.findFirst({
    where: {
      slug: input.slug,
      tenantId: input.tenantId,
      isActive: true,
      websiteVisible: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      teamSeasons: {
        where: {
          status: "ACTIVE",
          websiteVisible: true,
          ...seasonWhere,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          displayName: true,
          shortName: true,
          squadWebsiteVisible: true,
          trainerTeamWebsiteVisible: true,
          showNextMatch: true,
          showNextTournament: true,
          season: { select: { key: true, name: true } },
        },
      },
    },
  });

  if (!team) return null;

  const teamSeason = team.teamSeasons[0] ?? null;

  // ── Phase 2a: Squad ──────────────────────────────────────────────────────
  // Query is skipped entirely when squadWebsiteVisible = false.
  // Both filters (isWebsiteVisible, status) are in the Prisma WHERE clause:
  // hidden members never leave the database, even when the season flag is true.
  const squad: PublicSquadMember[] = teamSeason?.squadWebsiteVisible
    ? await prisma.playerSquadMember
        .findMany({
          where: {
            teamSeasonId: teamSeason.id,
            status: "ACTIVE",
            isWebsiteVisible: true,
          },
          orderBy: [
            { sortOrder: "asc" },
            { shirtNumber: "asc" },
            { person: { lastName: "asc" } },
            { person: { firstName: "asc" } },
          ],
          select: {
            shirtNumber: true,
            positionLabel: true,
            isCaptain: true,
            isViceCaptain: true,
            person: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
        .then((rows) =>
          rows.map((m) => ({
            firstName: m.person.firstName,
            lastName: m.person.lastName,
            shirtNumber: m.shirtNumber ?? null,
            positionLabel: m.positionLabel ?? null,
            captain: m.isCaptain,
            viceCaptain: m.isViceCaptain,
            photo: null,
          })),
        )
    : [];

  // ── Phase 2b: Trainer staff ──────────────────────────────────────────────
  // Query is skipped entirely when trainerTeamWebsiteVisible = false.
  // Both filters (isWebsiteVisible, status) are in the Prisma WHERE clause:
  // hidden members never leave the database, even when the season flag is true.
  const trainers: PublicTrainerMember[] = teamSeason?.trainerTeamWebsiteVisible
    ? await prisma.trainerTeamMember
        .findMany({
          where: {
            teamSeasonId: teamSeason.id,
            status: "ACTIVE",
            isWebsiteVisible: true,
          },
          orderBy: [{ sortOrder: "asc" }, { person: { lastName: "asc" } }],
          select: {
            roleLabel: true,
            person: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
        .then((rows) =>
          rows.map((t) => ({
            firstName: t.person.firstName,
            lastName: t.person.lastName,
            roleLabel: t.roleLabel ?? null,
            photo: null,
          })),
        )
    : [];

  // ── Phase 3: Upcoming training sessions ─────────────────────────────────
  // Scoped by teamId + tenantId (double tenant guard).
  // pitchCode is fetched only for internal name resolution; never returned.
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

  const rawTrainingEvents = await prisma.event.findMany({
    where: {
      teamId: team.id,
      tenantId: input.tenantId,
      type: "TRAINING",
      status: { notIn: ["CANCELLED", "ARCHIVED"] },
      websiteVisible: true,
      startAt: { gte: now, lte: windowEnd },
    },
    orderBy: { startAt: "asc" },
    take: 20,
    select: {
      startAt: true,
      endAt: true,
      location: true,
      pitchCode: true,
    },
  });

  // Resolve pitchCode → human-readable pitchName via FacilityResource.
  // The raw pitchCode is never returned in the public response.
  const uniquePitchCodes = [
    ...new Set(
      rawTrainingEvents
        .map((e) => e.pitchCode)
        .filter((c): c is string => c !== null),
    ),
  ];

  const pitchNameMap = new Map<string, string>();
  if (uniquePitchCodes.length > 0) {
    const resources = await prisma.facilityResource.findMany({
      where: {
        tenantId: input.tenantId,
        code: { in: uniquePitchCodes },
        status: "ACTIVE",
      },
      select: { code: true, name: true },
    });
    for (const r of resources) {
      pitchNameMap.set(r.code, r.name);
    }
  }

  // Map training sessions — derive weekday from startAt using de-CH locale.
  const training: PublicTeamTrainingSession[] = rawTrainingEvents.map((e) => ({
    weekday: e.startAt.toLocaleDateString("de-CH", {
      weekday: "long",
      timeZone: "Europe/Zurich",
    }),
    startTime: e.startAt.toISOString(),
    endTime: e.endAt?.toISOString() ?? null,
    location: e.location ?? null,
    pitchName: e.pitchCode ? (pitchNameMap.get(e.pitchCode) ?? null) : null,
  }));

  // ── Phase 4+5+6: Upcoming matches, recent results, standings ───────────
  let nextMatches: PublicTeamMatch[] = [];
  let results: PublicTeamMatch[] = [];
  let standings: PublicTeamStandings | null = null;
  let nextTournament: PublicWebsiteTournamentItem | null = null;
  const publication: PublicTeamPublication = {
    showNextMatch: teamSeason?.showNextMatch ?? true,
    showNextTournament: teamSeason?.showNextTournament ?? false,
  };

  if (teamSeason) {
    if (publication.showNextTournament) {
      const tournamentEvent = await findNextTournamentEventForTeamSeason(
        input.tenantId,
        teamSeason.id,
        now,
      );

      if (tournamentEvent) {
        const [tournament] = await listTournamentsByIds(input.tenantId, [
          tournamentEvent.id,
        ]);
        nextTournament = tournament
          ? toPublicWebsiteTournamentFromDto(tournament)
          : null;
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true, logoUrl: true },
    });

    const { upcoming, completed } = await listTeamSeasonMatches(
      prisma as unknown as TeamMatchQueryDatabase,
      {
        tenantId: input.tenantId,
        teamSeasonId: teamSeason.id,
        now,
        websiteVisibleOnly: true,
      },
    );

    const teamIds = new Set<string>();
    const externalTeamIds = new Set<string>();

    for (const item of [...upcoming, ...completed]) {
      for (const side of [item.home, item.away]) {
        if (side.canonicalTeamId) {
          teamIds.add(side.canonicalTeamId);
        }

        if (side.canonicalExternalTeamId) {
          externalTeamIds.add(side.canonicalExternalTeamId);
        }
      }
    }

    const [teams, externalTeams] = await Promise.all([
      teamIds.size > 0
        ? prisma.team.findMany({
            where: {
              id: { in: [...teamIds] },
              tenantId: input.tenantId,
            },
            select: {
              id: true,
              shortName: true,
            },
          })
        : Promise.resolve([]),
      externalTeamIds.size > 0
        ? prisma.externalTeam.findMany({
            where: {
              id: { in: [...externalTeamIds] },
              tenantId: input.tenantId,
            },
            select: {
              id: true,
              shortName: true,
              logoUrl: true,
              providerMappings: CANONICAL_EXTERNAL_TEAM_PROVIDER_MAPPING_SELECT,
              externalClub: {
                select: {
                  name: true,
                  logoUrl: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const canonicalLogoByProviderClubId = await loadCanonicalClubLogoIndex(
      input.tenantId,
      collectProviderClubIdsFromExternalTeams(externalTeams),
    );

    const teamById = new Map<string, PublicTeamMatchTeamRecord>(
      teams.map((team) => [team.id, team]),
    );
    const externalTeamById = new Map<string, PublicTeamMatchExternalTeamRecord>(
      externalTeams.map((externalTeam) => [
        externalTeam.id,
        {
          id: externalTeam.id,
          shortName: externalTeam.shortName,
          logoUrl: resolveExternalTeamLogoWithCanonicalFallback(
            {
              team: externalTeam,
              directClub: externalTeam.externalClub,
              providerMappings: externalTeam.providerMappings,
            },
            canonicalLogoByProviderClubId,
          ),
          clubName: externalTeam.externalClub.name,
        },
      ]),
    );

    const identityContext: PublicTeamMatchIdentityContext = {
      currentTeamId: team.id,
      tenantLogoUrl: tenant?.logoUrl ?? null,
      tenantClubName: tenant?.name ?? team.name,
      teamById,
      externalTeamById,
    };

    nextMatches = mapPublicTeamMatches(upcoming, identityContext, now);
    results = mapPublicTeamResults(completed, identityContext);

    // ── Phase 6: Standings (best-effort) ─────────────────────────────────
    const mapping = await prisma.teamExternalMapping.findFirst({
      where: {
        tenantId: input.tenantId,
        teamSeasonId: teamSeason.id,
        provider: SFV_PROVIDER,
        providerIsActive: true,
      },
      select: {
        externalTeamId: true,
        externalSeasonId: true,
        providerLeagueId: true,
      },
    });

    if (mapping) {
      const seasonCandidates = getSeasonKeyLookupCandidatesFromSfvExternalSeasonId(
        mapping.externalSeasonId,
      );
      const seasonAligned = seasonCandidates.includes(teamSeason.season.key);

      if (seasonAligned) {
        const standingsTable = await fetchTeamStandingsForMapping({
          tenantId: input.tenantId,
          externalTeamId: mapping.externalTeamId,
          externalSeasonId: mapping.externalSeasonId,
          providerLeagueId: mapping.providerLeagueId,
        });

        if (standingsTable) {
          const standingsEnrichmentByProviderTeamId =
            await buildStandingsClubEnrichmentByProviderTeamId({
              tenantId: input.tenantId,
              rows: standingsTable.rows.map((row) => ({
                providerTeamId: row.externalTeamId,
                providerTeamName: row.teamName,
              })),
            });

          const externalTeamByProviderId = new Map<
            number,
            PublicTeamStandingsExternalTeamRecord
          >();

          for (const [providerTeamId, enrichment] of standingsEnrichmentByProviderTeamId) {
            externalTeamByProviderId.set(providerTeamId, {
              shortName: enrichment.shortName,
              logoUrl: enrichment.logoUrl,
            });
          }

          const standingsIdentityContext: PublicTeamStandingsIdentityContext = {
            currentExternalTeamId: mapping.externalTeamId,
            currentTeamName: teamSeason.displayName,
            currentTeamShortName: teamSeason.shortName,
            tenantLogoUrl: tenant?.logoUrl ?? null,
            externalTeamByProviderId,
          };

          standings = mapPublicTeamStandings(
            standingsTable,
            standingsIdentityContext,
          );
        }
      }
    }
  }

  return {
    name: team.name,
    displayName: teamSeason?.displayName ?? team.name,
    slug: team.slug,
    category: team.category,
    ageGroup: team.ageGroup ?? null,
    genderGroup: team.genderGroup ?? null,
    shortName: teamSeason?.shortName ?? null,
    season: teamSeason?.season ?? null,
    description: null,
    heroImage: null,
    squad,
    trainers,
    training,
    publication,
    nextMatches,
    results,
    standings,
    nextTournament,
    nextEvent: resolvePublicTeamNextEvent({
      publication,
      nextMatch: nextMatches[0] ?? null,
      nextTournament,
    }),
  };
}
