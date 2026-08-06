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
  recurrenceDays: { weekday: string }[];
};

const include = {
  recurrenceDays: {
    select: { weekday: true },
    orderBy: { weekday: "asc" as const },
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
    include,
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
    include,
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
 * Returns every TrainingSession row for `trainingSeriesId` whose `date`
 * falls within [from, to] (both inclusive, UTC-midnight calendar dates).
 *
 * Used by the generation service to diff already-generated rows against
 * freshly computed occurrences — scoped by tenantId defensively even though
 * trainingSeriesId is already tenant-validated by the caller.
 */
export async function findTrainingSessionsForSeriesInWindow(
  tenantId: string,
  trainingSeriesId: string,
  from: Date,
  to: Date,
): Promise<TrainingSessionScheduleRow[]> {
  return prisma.trainingSession.findMany({
    where: {
      tenantId,
      trainingSeriesId,
      date: { gte: from, lte: to },
    },
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
 * Deliberately never touches `status` — future exception/override handling
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

/** Returns TrainingSession rows for a tenant, with optional filters. Ordered by date, then startAt. */
export async function findAllTrainingSessions(
  tenantId: string,
  opts: {
    trainingSeriesId?: string;
    teamSeasonId?: string;
    status?: TrainingSessionStatus;
    dateFrom?: Date;
    dateTo?: Date;
  } = {},
): Promise<TrainingSessionRow[]> {
  const { trainingSeriesId, teamSeasonId, status, dateFrom, dateTo } = opts;

  return prisma.trainingSession.findMany({
    where: {
      tenantId,
      ...(trainingSeriesId ? { trainingSeriesId } : {}),
      ...(teamSeasonId ? { teamSeasonId } : {}),
      ...(status ? { status } : {}),
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
