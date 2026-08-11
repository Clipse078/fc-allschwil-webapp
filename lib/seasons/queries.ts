import { prisma } from "@/lib/db/prisma";
import {
  getCurrentSwissFootballSeason,
  getNextSwissFootballSeason,
  getSeasonLifecycleStatus,
} from "@/lib/seasons/season-logic";
import { getSeasonCurrentStatus, getSeasonCurrentStatusLabel, getSeasonLifecycleStatusLabel } from "@/lib/seasons/status";

/**
 * SEASON-01 root-cause fix.
 *
 * Previously, every read here (`getSeasonOptionsData`, `getCurrentSeasonOptionData`,
 * `getNextSeasonOptionData`, `getSeasonsOverviewData`) called a
 * `syncSeasonActiveFlagsWithLifecycle()` side effect that recomputed
 * `Season.isActive` from calendar dates on every page load. That is the
 * documented root cause of two STAGE symptoms: (1) visiting an unrelated
 * page could silently flip which Season is "current", overriding an
 * explicit admin choice; and (2) when no Season's date range covers
 * "today" (e.g. the actual current season was never created), the sync
 * cleared every Season's `isActive` flag, leaving nothing marked AKTUELL.
 *
 * `Season.isActive` is now updated in exactly one place — the transactional
 * "Aktuell setzen" action (POST /api/seasons/[seasonId]/activate,
 * lib/seasons/mutations.ts) — and every read below simply consumes the
 * persisted flag. No read path may resurrect a lifecycle-based auto-sync;
 * see the module doc in lib/teams/current-season.ts for the single
 * canonical "current TeamSeason" resolution rule this flag feeds.
 */

export async function getSeasonOptionsData() {
  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  return seasons.map((season) => {
    const lifecycleStatus =
      getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      }) ?? "PLANNING";

    return {
      ...season,
      lifecycleStatus,
      lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
      shouldBeActive: lifecycleStatus === "ONGOING",
    };
  });
}

export async function getCurrentSeasonOptionData() {
  const current = getCurrentSwissFootballSeason();

  if (!current) {
    return null;
  }

  const season = await prisma.season.findFirst({
    where: {
      key: current.key,
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!season) {
    return null;
  }

  const lifecycleStatus =
    getSeasonLifecycleStatus({
      startDate: season.startDate,
      endDate: season.endDate,
    }) ?? "PLANNING";

  return {
    ...season,
    lifecycleStatus,
    lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
    shouldBeActive: lifecycleStatus === "ONGOING",
  };
}

export async function getNextSeasonOptionData() {
  const next = getNextSwissFootballSeason();

  if (!next) {
    return null;
  }

  const season = await prisma.season.findFirst({
    where: {
      key: next.key,
    },
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!season) {
    return null;
  }

  const lifecycleStatus =
    getSeasonLifecycleStatus({
      startDate: season.startDate,
      endDate: season.endDate,
    }) ?? "PLANNING";

  return {
    ...season,
    lifecycleStatus,
    lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
    shouldBeActive: lifecycleStatus === "ONGOING",
  };
}

export async function getSeasonsOverviewData() {
  const seasons = await prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      startDate: true,
      endDate: true,
      _count: {
        select: {
          teamSeasons: true,
          events: true,
          trainingPlans: true,
        },
      },
    },
  });

  return seasons.map((season) => {
    const lifecycleStatus =
      getSeasonLifecycleStatus({
        startDate: season.startDate,
        endDate: season.endDate,
      }) ?? "PLANNING";

    const currentStatus = getSeasonCurrentStatus({
      isActive: season.isActive,
      endDate: season.endDate,
    });

    return {
      id: season.id,
      key: season.key,
      name: season.name,
      isActive: season.isActive,
      startDate: season.startDate,
      endDate: season.endDate,
      lifecycleStatus,
      lifecycleStatusLabel: getSeasonLifecycleStatusLabel(lifecycleStatus),
      shouldBeActive: lifecycleStatus === "ONGOING",
      currentStatus,
      currentStatusLabel: getSeasonCurrentStatusLabel(currentStatus),
      teamSeasonCount: season._count.teamSeasons,
      eventCount: season._count.events,
      trainingPlanCount: season._count.trainingPlans,
    };
  });
}

export type SeasonDependencyCounts = {
  teamSeasons: number;
  events: number;
  eventImportRuns: number;
  trainingPlans: number;
  orgUnitMemberships: number;
};

/**
 * ADMIN-DELETE-SEASON-01-C1: All Season-referencing relations counted for
 * display/audit. None block deletion outright:
 *
 *   TeamSeason          — onDelete: Cascade → rows removed (Team survives)
 *   Event.seasonId      — onDelete: SetNull → Event preserved, seasonId → null
 *   TrainingPlan.seasonId — onDelete: SetNull → plan preserved, seasonId → null
 *   EventImportRun      — onDelete: SetNull (unchanged, already optional)
 *   OrgUnitMembership   — onDelete: SetNull (unchanged, already optional)
 *
 * Counts are shown in the impact dialog so the admin understands what will
 * happen, but none of them block the delete operation.
 */
export async function getSeasonDependencyCounts(seasonId: string): Promise<SeasonDependencyCounts> {
  const [teamSeasons, events, eventImportRuns, trainingPlans, orgUnitMemberships] = await Promise.all([
    prisma.teamSeason.count({ where: { seasonId } }),
    prisma.event.count({ where: { seasonId } }),
    prisma.eventImportRun.count({ where: { seasonId } }),
    prisma.trainingPlan.count({ where: { seasonId } }),
    prisma.orgUnitMembership.count({ where: { seasonId } }),
  ]);

  return { teamSeasons, events, eventImportRuns, trainingPlans, orgUnitMemberships };
}

/**
 * ADMIN-DELETE-SEASON-01-C1: Season deletion is never blocked by dependency
 * counts. All relations are either Cascade (TeamSeason — desired cleanup) or
 * SetNull (Event, TrainingPlan, EventImportRun, OrgUnitMembership — records
 * survive). This function is preserved for backward-compat test references
 * but always returns false.
 *
 * @deprecated No longer used in the delete path. Kept for test coverage only.
 */
export function hasSeasonDependencies(_counts: SeasonDependencyCounts): boolean {
  return false;
}
