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
import type {
  PublicTeamListItem,
  PublicTeamDetail,
  PublicSquadMember,
  PublicTrainerMember,
  PublicTeamTrainingSession,
} from "@/lib/website/types";

// Local type matching the Prisma select shape, used to avoid implicit `any`
// on the map callback (Prisma client must be generated for full inference).
type TeamRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  teamSeasons: Array<{
    displayName: string;
    shortName: string | null;
    season: { key: string; name: string };
  }>;
};

export type GetPublicTeamsInput = {
  /** Required: DB-level tenant isolation via Team.tenantId. */
  tenantId: string;
  seasonKey?: string | null;
};

/**
 * Returns website-visible active teams for the given tenant with their
 * active-season display names.
 *
 * Results are ordered by category, sortOrder, then name — consistent with
 * the admin teams list ordering.
 */
export async function getPublicTeams(
  input: GetPublicTeamsInput,
): Promise<PublicTeamListItem[]> {
  // TEAMCENTER-UX-01C: canonical current-season resolution — see
  // lib/teams/current-season.ts. Keeps the public website consistent with
  // the admin Teams UI/TrainingCenter for the same Team.
  const seasonWhere = currentTeamSeasonWhere(input.seasonKey);

  const teams = await prisma.team.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      websiteVisible: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      teamSeasons: {
        where: seasonWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          displayName: true,
          shortName: true,
          season: { select: { key: true, name: true } },
        },
      },
    },
  });

  return (teams as TeamRow[]).map((team) => {
    const activeSeason = team.teamSeasons[0] ?? null;
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
    };
  });
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
  };
}
