/**
 * lib/seasons/mutations.ts
 *
 * SEASON-01 — canonical Season lifecycle mutations.
 *
 * Product rule this module implements: "A Season is primarily
 * classification/context" — arbitrary sensible Seasons may coexist
 * (2025/2026, 2026/2027, 2027/2028, ...), and there is exactly ONE
 * explicit current Season, set only by `activateSeason()` ("Aktuell
 * setzen"). Nothing here ever derives/overrides `Season.isActive` from
 * calendar dates — see lib/seasons/queries.ts module doc for the removed
 * `syncSeasonActiveFlagsWithLifecycle()` side effect this replaces.
 *
 * Every route (app/api/seasons/**) and server action
 * (app/(admin)/dashboard/seasons/actions.ts) delegates to this module —
 * there is exactly one implementation of each Season write.
 */

import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  getNextSwissFootballSeason,
  getSwissFootballSeasonDateRangeFromStartYear,
  getSwissFootballSeasonKeyFromStartYear,
  getSwissFootballSeasonLabelFromStartYear,
} from "@/lib/seasons/season-logic";
import { getSeasonDependencyCounts } from "@/lib/seasons/queries";
import {
  DuplicateSeasonError,
  SeasonNotFoundError,
  SeasonValidationError,
} from "@/lib/seasons/errors";

const AUDIT_MODULE_KEY = "seasons";

const SEASON_SELECT = {
  id: true,
  key: true,
  name: true,
  isActive: true,
  startDate: true,
  endDate: true,
} as const;

export type SeasonRow = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateSeasonInput = {
  /**
   * Explicit Swiss-football season start year (e.g. `2026` creates
   * "2026/2027"). SEASON-01: creation is never blocked by the existence of
   * an earlier or later Season — "next season already exists" is retired.
   * Only an exact duplicate (same key) is rejected.
   */
  startYear: number;
};

export async function createSeason(
  input: CreateSeasonInput,
  actorUserId?: string | null,
): Promise<SeasonRow> {
  const { startYear } = input;
  if (!Number.isInteger(startYear)) {
    throw new SeasonValidationError("Ein gültiges Startjahr ist erforderlich.");
  }

  const key = getSwissFootballSeasonKeyFromStartYear(startYear);
  const name = `Season ${getSwissFootballSeasonLabelFromStartYear(startYear)}`;
  const range = getSwissFootballSeasonDateRangeFromStartYear(startYear);

  const existing = await prisma.season.findUnique({
    where: { key },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new DuplicateSeasonError(existing.name);
  }

  const created = await prisma.season.create({
    data: {
      key,
      name,
      startDate: range.startDate,
      endDate: range.endDate,
      isActive: false,
    },
    select: SEASON_SELECT,
  });

  await logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Season",
    entityId: created.id,
    action: "CREATE",
    afterJson: { key: created.key, name: created.name },
  });

  return created;
}

/**
 * Pure UI convenience: the calendar-computed "next" season's start year,
 * used only to pre-fill the "Neue Saison" form with a sane default.
 * `createSeason()` itself never restricts on, or requires, this value.
 */
export function suggestNextSeasonStartYear(now: Date = new Date()): number | null {
  return getNextSwissFootballSeason(now)?.startYear ?? null;
}

// ---------------------------------------------------------------------------
// Update details (label / dates)
// ---------------------------------------------------------------------------

export type UpdateSeasonDetailsInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
};

export async function updateSeasonDetails(
  seasonId: string,
  input: UpdateSeasonDetailsInput,
  actorUserId?: string | null,
): Promise<SeasonRow> {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: SEASON_SELECT });
  if (!season) throw new SeasonNotFoundError();

  const data: { name?: string; startDate?: Date; endDate?: Date } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new SeasonValidationError("Der Name ist erforderlich.");
    data.name = name;
  }

  const nextStart = input.startDate ?? season.startDate;
  const nextEnd = input.endDate ?? season.endDate;
  if (!(nextEnd.getTime() > nextStart.getTime())) {
    throw new SeasonValidationError("Das Enddatum muss nach dem Startdatum liegen.");
  }

  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;

  const before = { name: season.name, startDate: season.startDate, endDate: season.endDate };

  const updated = await prisma.season.update({ where: { id: seasonId }, data, select: SEASON_SELECT });

  await logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Season",
    entityId: updated.id,
    action: "UPDATE",
    beforeJson: before,
    afterJson: { name: updated.name, startDate: updated.startDate, endDate: updated.endDate },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Activate ("Aktuell setzen") — the ONLY writer of Season.isActive
// ---------------------------------------------------------------------------

export type ActivateSeasonResult = { season: SeasonRow; alreadyActive: boolean };

export async function activateSeason(
  seasonId: string,
  actorUserId?: string | null,
): Promise<ActivateSeasonResult> {
  const targetSeason = await prisma.season.findUnique({ where: { id: seasonId }, select: SEASON_SELECT });
  if (!targetSeason) throw new SeasonNotFoundError();

  if (targetSeason.isActive) {
    return { season: targetSeason, alreadyActive: true };
  }

  const previousActiveSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: SEASON_SELECT,
  });

  await prisma.$transaction([
    prisma.season.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.season.update({ where: { id: targetSeason.id }, data: { isActive: true } }),
  ]);

  await logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Season",
    entityId: targetSeason.id,
    action: "ACTIVATE",
    beforeJson: {
      previousActiveSeasonId: previousActiveSeason?.id ?? null,
      previousActiveSeasonKey: previousActiveSeason?.key ?? null,
    },
    afterJson: { newActiveSeasonId: targetSeason.id, newActiveSeasonKey: targetSeason.key },
  });

  return { season: { ...targetSeason, isActive: true }, alreadyActive: false };
}

// ---------------------------------------------------------------------------
// Delete — ADMIN-DELETE-SEASON-01-C1: force-decouple, never destroys canonical
// Event/Match/Tournament or TrainingPlan history.
//
// Semantics after C1:
//   TeamSeason rows     → deleted (Season-scoped join table, Team survives)
//   Event.seasonId      → set NULL by onDelete: SetNull FK (Event survives)
//   TrainingPlan.seasonId → set NULL by onDelete: SetNull FK (plan survives)
//   EventImportRun, OrgUnitMembership → already SetNull, unchanged
//
// The Season is deleted unconditionally (for authorized callers). Impact
// counts are fetched immediately before deletion for the audit log only.
// ---------------------------------------------------------------------------

export async function deleteSeason(
  seasonId: string,
  actorUserId?: string | null,
): Promise<{ id: string; name: string; counts: import("@/lib/seasons/queries").SeasonDependencyCounts }> {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: SEASON_SELECT });
  if (!season) throw new SeasonNotFoundError();

  // Recompute impact immediately before deletion for audit accuracy.
  const counts = await getSeasonDependencyCounts(seasonId);

  // Single delete: DB FK actions handle the rest —
  //   TeamSeason: onDelete Cascade  → rows removed
  //   Event.seasonId: onDelete SetNull → seasonId set to null, Event preserved
  //   TrainingPlan.seasonId: onDelete SetNull → seasonId set to null, plan preserved
  await prisma.season.delete({ where: { id: seasonId } });

  await logAction({
    actorUserId: actorUserId ?? null,
    moduleKey: AUDIT_MODULE_KEY,
    entityType: "Season",
    entityId: season.id,
    action: "DELETE",
    beforeJson: {
      key: season.key,
      name: season.name,
      wasActive: season.isActive,
      teamSeasonCount: counts.teamSeasons,
      eventCount: counts.events,
      trainingPlanCount: counts.trainingPlans,
    },
  });

  return { id: season.id, name: season.name, counts };
}
