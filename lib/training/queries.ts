/**
 * lib/training/queries.ts
 *
 * Low-level Prisma queries for the Training module.
 *
 * All queries are scoped by tenantId via the TeamSeason → Team relation.
 * No business logic here — that lives in training-service.ts.
 *
 * Security invariants:
 *   - Tenant A cannot read Tenant B's training series.
 *   - tenantId is always validated through the TeamSeason → Team join.
 */

import { prisma } from "@/lib/db/prisma";
import type { TrainingSeriesStatus, TrainingSessionStatus, Weekday } from "./types";

// ── Row shape returned by the DB ──────────────────────────────────────────────

export type TrainingSeriesRow = {
  id: string;
  tenantId: string;
  teamSeasonId: string;
  title: string;
  description: string | null;
  status: TrainingSeriesStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  validFrom: Date | null;
  validUntil: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /// TRAININGCENTER-03A: startsAt/endsAt are nullable per-weekday overrides —
  /// null means "fall back to the parent TrainingSeries.startsAt/endsAt".
  recurrenceDays: { weekday: string; startsAt: string | null; endsAt: string | null }[];
  /// TRAININGCENTER-03A: count of canonical TrainingSession rows generated for this series.
  _count?: { sessions: number };
};

export const trainingSeriesInclude = {
  recurrenceDays: {
    select: { weekday: true, startsAt: true, endsAt: true },
    orderBy: { weekday: "asc" as const },
  },
  _count: {
    select: { sessions: true },
  },
} as const;

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns a TrainingSeries by id, scoped to the tenant. */
export async function findTrainingSeriesById(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesRow | null> {
  return prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    include: trainingSeriesInclude,
  }) as Promise<TrainingSeriesRow | null>;
}

/** Returns all TrainingSeries for a tenant, with optional filters. */
export async function findAllTrainingSeries(
  tenantId: string,
  opts: {
    teamSeasonId?: string;
    status?: TrainingSeriesStatus;
    includeArchived?: boolean;
  } = {},
): Promise<TrainingSeriesRow[]> {
  const { teamSeasonId, status, includeArchived = false } = opts;

  return prisma.trainingSeries.findMany({
    where: {
      tenantId,
      ...(teamSeasonId ? { teamSeasonId } : {}),
      ...(status ? { status } : !includeArchived ? { NOT: { status: "ARCHIVED" } } : {}),
    },
    include: trainingSeriesInclude,
    orderBy: [{ teamSeasonId: "asc" }, { title: "asc" }],
  }) as Promise<TrainingSeriesRow[]>;
}

/**
 * Checks tenant ownership of a TeamSeason.
 *
 * Returns the TeamSeason row (with team) when it belongs to the tenant,
 * or null when it does not exist or belongs to a different tenant.
 */
export async function findTeamSeasonForTenant(
  tenantId: string,
  teamSeasonId: string,
): Promise<{ id: string; team: { id: string; isActive: boolean; tenantId: string | null } } | null> {
  return prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      team: { tenantId },
    },
    select: {
      id: true,
      team: {
        select: { id: true, isActive: true, tenantId: true },
      },
    },
  });
}

/**
 * TRAININGCENTER-03A: Row shape for the "Team / TeamSeason" picker used by
 * the TrainingSeries create/edit form.
 *
 * Only active TeamSeasons belonging to active teams are eligible — creating
 * a TrainingSeries for an inactive team is rejected at the service layer
 * (see TrainingSeriesArchivedTeamError), so the picker only ever offers
 * choices that will actually succeed.
 *
 * trainers is the "Trainers where supported" display: the ACTIVE
 * TrainerTeamMember roster already assigned to this TeamSeason. There is no
 * per-TrainingSeries trainer assignment model yet — trainers are shown
 * read-only, sourced from the canonical team-level roster.
 */
export type TeamSeasonPickerRow = {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
  trainers: { id: string; name: string; roleLabel: string | null }[];
};

/** Returns every active TeamSeason (of an active Team) for a tenant, for use in pickers. */
export async function findTeamSeasonsForTenant(
  tenantId: string,
): Promise<TeamSeasonPickerRow[]> {
  const rows = await prisma.teamSeason.findMany({
    where: {
      status: "ACTIVE",
      team: { tenantId, isActive: true },
    },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true } },
      season: { select: { name: true } },
      trainerTeamMembers: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          roleLabel: true,
          person: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
    orderBy: [{ team: { name: "asc" } }, { season: { startDate: "desc" } }],
  });

  return rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    teamName: row.team.name,
    seasonName: row.season.name,
    trainers: row.trainerTeamMembers.map((t) => ({
      id: t.id,
      name: t.person.displayName || `${t.person.firstName} ${t.person.lastName}`,
      roleLabel: t.roleLabel,
    })),
  }));
}

// =============================================================================
// TRAININGCENTER-02: TrainingSession queries
// =============================================================================

/** Minimal row shape used internally by the generation service to diff against generated occurrences. */
export type TrainingSessionScheduleRow = {
  id: string;
  date: Date;
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
  status: TrainingSessionStatus;
};

/** Row shape returned by the public read queries (includes the denormalised series title). */
export type TrainingSessionRow = TrainingSessionScheduleRow & {
  tenantId: string;
  trainingSeriesId: string;
  teamSeasonId: string;
  createdAt: Date;
  updatedAt: Date;
  trainingSeries: { title: string };
};

const sessionScheduleSelect = {
  id: true,
  date: true,
  weekday: true,
  startAt: true,
  endAt: true,
  timezone: true,
  status: true,
} as const;

const sessionFullSelect = {
  ...sessionScheduleSelect,
  tenantId: true,
  trainingSeriesId: true,
  teamSeasonId: true,
  createdAt: true,
  updatedAt: true,
  trainingSeries: { select: { title: true } },
} as const;

/**
 * Returns every TrainingSession row ever generated for `trainingSeriesId`,
 * regardless of date or the caller's current generation window.
 *
 * TRAININGCENTER-03A-FIX: reconciliation must be able to detect and
 * deactivate stale rows that fall outside the currently requested
 * generation window (e.g. sessions after a shortened validUntil, or before
 * a validFrom moved forward) — diffing only within the window would miss
 * exactly the rows the fix needs to catch. Scoped by tenantId defensively
 * even though trainingSeriesId is already tenant-validated by the caller.
 */
export async function findAllTrainingSessionsForSeries(
  tenantId: string,
  trainingSeriesId: string,
): Promise<TrainingSessionScheduleRow[]> {
  return prisma.trainingSession.findMany({
    where: { tenantId, trainingSeriesId },
    select: sessionScheduleSelect,
  }) as Promise<TrainingSessionScheduleRow[]>;
}

/** Row shape accepted by createManyTrainingSessions(). */
export type CreateTrainingSessionRow = {
  tenantId: string;
  trainingSeriesId: string;
  teamSeasonId: string;
  date: Date;
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
};

/**
 * Bulk-inserts newly generated TrainingSession rows.
 *
 * Relies on @@unique([trainingSeriesId, date]) as a defence-in-depth guard:
 * callers are expected to only pass rows that don't already exist (per the
 * diff performed in the generation service), but a concurrent generation
 * run for the same series/window would fail the unique constraint rather
 * than silently duplicate a session.
 */
export async function createManyTrainingSessions(
  rows: CreateTrainingSessionRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await prisma.trainingSession.createMany({
    data: rows.map((row) => ({ ...row, status: "SCHEDULED" })),
  });
  return result.count;
}

/** Fields that may be re-synced on an existing TrainingSession when its series' recurrence changes. */
export type TrainingSessionScheduleUpdate = {
  weekday: Weekday;
  startAt: Date;
  endAt: Date;
  timezone: string;
};

/**
 * Updates only the derived schedule fields of an existing TrainingSession.
 *
 * Deliberately never touches `status` — exception/override handling
 * (CANCELLED, POSTPONED, MOVED) must survive regeneration runs.
 */
export async function updateTrainingSessionSchedule(
  sessionId: string,
  data: TrainingSessionScheduleUpdate,
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data,
  });
}

/**
 * TRAININGCENTER-03A-FIX: marks a previously-SCHEDULED TrainingSession as
 * RECURRENCE_REMOVED because its date no longer matches its series'
 * recurrence rule.
 *
 * Callers must only invoke this for rows currently in status SCHEDULED —
 * CANCELLED/POSTPONED/MOVED rows are genuine operational history and must
 * never be overwritten by reconciliation.
 */
export async function deactivateTrainingSession(sessionId: string): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { status: "RECURRENCE_REMOVED" },
  });
}

/**
 * TRAININGCENTER-03A-FIX: reactivates a RECURRENCE_REMOVED TrainingSession
 * back to SCHEDULED and re-syncs its derived schedule, because its date
 * matches the series' recurrence rule again (e.g. a removed weekday was
 * re-added). Reuses the existing row — the caller must resolve it via the
 * (trainingSeriesId, date) unique row rather than creating a new one, so no
 * duplicate is ever produced for the same occurrence.
 */
export async function reactivateTrainingSessionSchedule(
  sessionId: string,
  data: TrainingSessionScheduleUpdate,
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { ...data, status: "SCHEDULED" },
  });
}

/** Returns a single TrainingSession by id, scoped to the tenant. */
export async function findTrainingSessionById(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionRow | null> {
  return prisma.trainingSession.findFirst({
    where: { id: sessionId, tenantId },
    select: sessionFullSelect,
  }) as Promise<TrainingSessionRow | null>;
}

/**
 * Returns TrainingSession rows for a tenant, with optional filters. Ordered
 * by date, then startAt.
 *
 * TRAININGCENTER-03A-FIX: canonical reads exclude RECURRENCE_REMOVED rows
 * by default (they are no longer part of the series' recurrence definition
 * and must not leak into Weekplanner/Dayplanner/Website/Infoboard
 * consumers). Pass `includeInactive: true` for historical/admin access.
 * An explicit `status` filter is itself an opt-in and is never combined
 * with the default exclusion.
 */
export async function findAllTrainingSessions(
  tenantId: string,
  opts: {
    trainingSeriesId?: string;
    teamSeasonId?: string;
    status?: TrainingSessionStatus;
    dateFrom?: Date;
    dateTo?: Date;
    includeInactive?: boolean;
  } = {},
): Promise<TrainingSessionRow[]> {
  const { trainingSeriesId, teamSeasonId, status, dateFrom, dateTo, includeInactive = false } =
    opts;

  return prisma.trainingSession.findMany({
    where: {
      tenantId,
      ...(trainingSeriesId ? { trainingSeriesId } : {}),
      ...(teamSeasonId ? { teamSeasonId } : {}),
      ...(status
        ? { status }
        : !includeInactive
          ? { NOT: { status: "RECURRENCE_REMOVED" } }
          : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    select: sessionFullSelect,
    orderBy: [{ date: "asc" }, { startAt: "asc" }],
  }) as Promise<TrainingSessionRow[]>;
}
