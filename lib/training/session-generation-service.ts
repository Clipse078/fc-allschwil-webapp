/**
 * lib/training/session-generation-service.ts
 *
 * TRAININGCENTER-02: Canonical Training Session Engine.
 *
 * Generates canonical TrainingSession rows from a TrainingSeries' recurrence
 * rule for a bounded window, and exposes the canonical read API that every
 * downstream consumer (Weekplanner, Dayplanner, Website, Infoboard) reads
 * training occurrences from.
 *
 * Architecture:
 *   TrainingSeries → TrainingSession (generated) → many consumers
 *
 * Canonical rule — "one generated session, many consumers":
 *   - generateTrainingSessions() is idempotent and safe to re-run for the
 *     same series/window as often as needed (e.g. a future nightly job that
 *     rolls the generation horizon forward). It never creates duplicate rows
 *     — @@unique([trainingSeriesId, date]) backs this at the DB level — and
 *     only writes rows whose derived schedule (weekday/startAt/endAt/
 *     timezone) actually changed.
 *   - It never touches `status` on CANCELLED / POSTPONED / MOVED rows —
 *     those are genuine, manually-set operational history and must survive
 *     regeneration untouched.
 *   - TRAININGCENTER-03A-FIX — reconciliation: rows whose date no longer
 *     satisfies the series' current recurrence rule (weekday removed,
 *     validFrom moved forward, validUntil moved back, ...) are transitioned
 *     SCHEDULED -> RECURRENCE_REMOVED rather than left stale. If the same
 *     date matches the recurrence again later (e.g. a removed weekday is
 *     re-added), the existing RECURRENCE_REMOVED row is reactivated back to
 *     SCHEDULED in place — never duplicated. See matchesRecurrence() in
 *     ./recurrence.ts for the (window-independent) membership test this
 *     relies on, and the TrainingSessionStatus doc comment in schema.prisma
 *     for why RECURRENCE_REMOVED is distinct from CANCELLED.
 *   - No downstream consumer generates its own occurrences; they all read
 *     via listTrainingSessions() / getTrainingSession() below, which exclude
 *     RECURRENCE_REMOVED rows by default.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - The TrainingSeries is resolved via findTrainingSeriesById(), which is
 *     already tenant-scoped — a cross-tenant series id is treated as not found.
 *   - All TrainingSession queries are scoped by tenantId.
 *
 * Explicitly out of scope for this PR (see the TrainingSession Prisma model
 * doc comment for the full list of future extension points):
 *   - Holidays, skipped dates, one-off exceptions.
 *   - Weekplan overrides (pitch, resource, dressing room, trainer, time,
 *     cancellation).
 *   - Attendance, weather, notes.
 */

import { prisma } from "@/lib/db/prisma";
import { resolveLongTeamName } from "@/lib/teams/team-naming";
import {
  generateTrainingSessionOccurrences,
  matchesRecurrence,
  toDateOnlyUtc,
  dateKeyFromDate,
  weekdayFromDate,
} from "./recurrence";
import {
  TrainingSeriesNotFoundError,
  TrainingSessionGenerationWindowError,
  TrainingSessionNotFoundError,
} from "./errors";
import { findTrainingSeriesById } from "./queries";
import {
  findAllTrainingSessionsForSeries,
  createManyTrainingSessions,
  updateTrainingSessionSchedule,
  deactivateTrainingSession,
  reactivateTrainingSessionSchedule,
  findTrainingSessionById,
  findAllTrainingSessions,
  type TrainingSessionRow,
} from "./queries";
import type {
  GenerateTrainingSessionsResult,
  ListTrainingSessionsFilter,
  TrainingSessionDto,
  TrainingSessionStatus,
  Weekday,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a DB row to the public DTO shape.
 *
 * TRAININGCENTER-02: resolves the EFFECTIVE date/weekday/startAt/endAt —
 * `overrideDate ?? date`, `overrideStartAt ?? startAt`, `overrideEndAt ??
 * endAt` — while exposing the canonical (series-derived) values separately
 * as `originalDate`/`originalStartAt`/`originalEndAt`. The weekday is only
 * recomputed when the date itself was overridden; a time-only override
 * never changes which weekday the occurrence falls on.
 */
function toDto(row: TrainingSessionRow): TrainingSessionDto {
  const teamSeason = row.trainingSeries.teamSeason;

  const effectiveDate = row.overrideDate ?? row.date;
  const effectiveStartAt = row.overrideStartAt ?? row.startAt;
  const effectiveEndAt = row.overrideEndAt ?? row.endAt;
  const isRescheduled = Boolean(row.overrideDate || row.overrideStartAt || row.overrideEndAt);

  return {
    id: row.id,
    tenantId: row.tenantId,
    trainingSeriesId: row.trainingSeriesId,
    trainingSeriesTitle: row.trainingSeries.title,
    teamSeasonId: row.teamSeasonId,
    teamName:
      resolveLongTeamName({
        teamSeasonDisplayName: teamSeason.displayName,
        teamName: teamSeason.team.name,
        teamShortName: teamSeason.team.shortName,
        teamAlternativeName: teamSeason.team.alternativeName,
      }) ?? teamSeason.displayName,
    date: dateKeyFromDate(effectiveDate),
    weekday: row.overrideDate ? weekdayFromDate(effectiveDate) : (row.weekday as Weekday),
    startAt: effectiveStartAt.toISOString(),
    endAt: effectiveEndAt.toISOString(),
    timezone: row.timezone,
    status: row.status as TrainingSessionStatus,
    originalDate: dateKeyFromDate(row.date),
    originalStartAt: row.startAt.toISOString(),
    originalEndAt: row.endAt.toISOString(),
    isRescheduled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Validates that `from`/`to` are real dates and `from` is not after `to`. */
function validateWindow(from: Date, to: Date): void {
  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw new TrainingSessionGenerationWindowError("`from` must be a valid Date");
  }
  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw new TrainingSessionGenerationWindowError("`to` must be a valid Date");
  }
  if (toDateOnlyUtc(from).getTime() > toDateOnlyUtc(to).getTime()) {
    throw new TrainingSessionGenerationWindowError("`from` must not be after `to`");
  }
}

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Generates (or re-syncs) canonical TrainingSession rows for `trainingSeriesId`
 * across the inclusive calendar-date window [window.from, window.to].
 *
 * Idempotent: calling this repeatedly with the same series and window
 * produces the same set of rows every time — no duplicates, and rows are
 * only written to when their derived schedule actually changed.
 *
 * Behaviour by series status:
 *   - ACTIVE:              occurrences are generated/synced as described above.
 *   - INACTIVE / ARCHIVED: no new occurrences are generated (all counts are
 *                          zero). Already-generated sessions, if any, are
 *                          left untouched — cascading cancellation when a
 *                          series is paused/archived is a future exception-
 *                          handling concern, not implemented here.
 *
 * @throws {TrainingSessionGenerationWindowError} `window.from`/`window.to` are invalid.
 * @throws {TrainingSeriesNotFoundError}          Series not found or cross-tenant.
 */
export async function generateTrainingSessions(
  tenantId: string,
  trainingSeriesId: string,
  window: { from: Date; to: Date },
): Promise<GenerateTrainingSessionsResult> {
  validateWindow(window.from, window.to);

  const series = await findTrainingSeriesById(tenantId, trainingSeriesId);
  if (!series) {
    throw new TrainingSeriesNotFoundError(trainingSeriesId);
  }

  if (series.status !== "ACTIVE") {
    return {
      trainingSeriesId,
      occurrencesInWindow: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      deactivated: 0,
      reactivated: 0,
    };
  }

  const rangeFrom = toDateOnlyUtc(window.from);
  const rangeTo = toDateOnlyUtc(window.to);

  // TRAININGCENTER-03A: each recurrence day may carry its own start/end time
  // override (e.g. Monday 17:00–18:00, Wednesday 16:00–17:00). Days without
  // an override fall back to the series-level startsAt/endsAt, handled by
  // the recurrence engine itself.
  const weekdayTimes: Partial<Record<Weekday, { startsAt: string; endsAt: string }>> = {};
  for (const day of series.recurrenceDays) {
    if (day.startsAt && day.endsAt) {
      weekdayTimes[day.weekday as Weekday] = { startsAt: day.startsAt, endsAt: day.endsAt };
    }
  }

  const recurrenceInput = {
    validFrom: series.validFrom,
    validUntil: series.validUntil,
    weekdays: series.recurrenceDays.map((d) => d.weekday as Weekday),
    timezone: series.timezone,
    startsAt: series.startsAt,
    endsAt: series.endsAt,
    weekdayTimes,
  };

  const occurrences = generateTrainingSessionOccurrences(recurrenceInput, {
    from: rangeFrom,
    to: rangeTo,
  });

  // TRAININGCENTER-03A-FIX: reconciliation must see every row ever generated
  // for this series, not just rows inside [rangeFrom, rangeTo] — a shortened
  // validUntil or a validFrom moved forward can strand previously-generated
  // rows entirely outside the window the caller happens to be regenerating
  // (e.g. the update API re-generates over the *new* [validFrom, validUntil],
  // which by construction excludes exactly the rows that need to be flagged
  // stale). See findAllTrainingSessionsForSeries() for the full rationale.
  const existingRows = await findAllTrainingSessionsForSeries(tenantId, trainingSeriesId);
  const existingByDateKey = new Map(
    existingRows.map((row) => [dateKeyFromDate(row.date), row]),
  );

  const toCreate: Array<{
    tenantId: string;
    trainingSeriesId: string;
    teamSeasonId: string;
    date: Date;
    weekday: Weekday;
    startAt: Date;
    endAt: Date;
    timezone: string;
  }> = [];

  let updated = 0;
  let unchanged = 0;
  let reactivated = 0;

  for (const occ of occurrences) {
    const existing = existingByDateKey.get(occ.dateKey);

    if (!existing) {
      toCreate.push({
        tenantId,
        trainingSeriesId,
        teamSeasonId: series.teamSeasonId,
        date: occ.date,
        weekday: occ.weekday,
        startAt: occ.startAt,
        endAt: occ.endAt,
        timezone: series.timezone,
      });
      continue;
    }

    const scheduleChanged =
      existing.weekday !== occ.weekday ||
      existing.startAt.getTime() !== occ.startAt.getTime() ||
      existing.endAt.getTime() !== occ.endAt.getTime() ||
      existing.timezone !== series.timezone;

    if (existing.status === "RECURRENCE_REMOVED") {
      // This date matches the recurrence again (e.g. a removed weekday was
      // re-added) — reactivate the existing row in place rather than create
      // a duplicate for the same (trainingSeriesId, date).
      await reactivateTrainingSessionSchedule(existing.id, {
        weekday: occ.weekday,
        startAt: occ.startAt,
        endAt: occ.endAt,
        timezone: series.timezone,
      });
      reactivated++;
      continue;
    }

    // SCHEDULED, CANCELLED, POSTPONED, MOVED — all keep their current status
    // (see updateTrainingSessionSchedule doc comment); only the derived
    // schedule is re-synced when it actually changed.
    if (scheduleChanged) {
      await updateTrainingSessionSchedule(existing.id, {
        weekday: occ.weekday,
        startAt: occ.startAt,
        endAt: occ.endAt,
        timezone: series.timezone,
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  const created = await createManyTrainingSessions(toCreate);

  // TRAININGCENTER-03A-FIX: deactivate rows that are stale — their date no
  // longer matches the series' recurrence rule at all — regardless of
  // whether that date falls inside the requested window. Only ever applied
  // to SCHEDULED rows: RECURRENCE_REMOVED is already reconciled (idempotent
  // no-op), and CANCELLED/POSTPONED/MOVED are genuine operational history
  // that reconciliation must never silently overwrite.
  let deactivated = 0;
  for (const row of existingRows) {
    if (row.status !== "SCHEDULED") continue;
    if (matchesRecurrence(row.date, recurrenceInput)) continue;
    await deactivateTrainingSession(row.id);
    deactivated++;
  }

  return {
    trainingSeriesId,
    occurrencesInWindow: occurrences.length,
    created,
    updated,
    unchanged,
    deactivated,
    reactivated,
  };
}

/**
 * Generates canonical TrainingSession rows for every ACTIVE TrainingSeries
 * belonging to `tenantId` across the given window.
 *
 * Convenience wrapper for future scheduled/batch invocation (e.g. a nightly
 * job that rolls the generation horizon forward for an entire tenant). Each
 * series is generated independently and failures are collected rather than
 * aborting the whole batch, since one malformed series should not prevent
 * every other series from being generated.
 */
export async function generateTrainingSessionsForTenant(
  tenantId: string,
  window: { from: Date; to: Date },
): Promise<{
  results: GenerateTrainingSessionsResult[];
  failures: Array<{ trainingSeriesId: string; error: string }>;
}> {
  const activeSeries = await prisma.trainingSeries.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true },
  });

  const results: GenerateTrainingSessionsResult[] = [];
  const failures: Array<{ trainingSeriesId: string; error: string }> = [];

  for (const series of activeSeries) {
    try {
      results.push(await generateTrainingSessions(tenantId, series.id, window));
    } catch (err) {
      failures.push({
        trainingSeriesId: series.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, failures };
}

// ── Canonical read API ───────────────────────────────────────────────────────

/**
 * Lists canonical TrainingSession rows for a tenant, with optional filters.
 *
 * This is the single read path every downstream consumer (Weekplanner,
 * Dayplanner, Website, Infoboard) should use — none of them resolve
 * occurrences from TrainingSeries directly.
 */
export async function listTrainingSessions(
  tenantId: string,
  filter: ListTrainingSessionsFilter = {},
): Promise<TrainingSessionDto[]> {
  const rows = await findAllTrainingSessions(tenantId, {
    trainingSeriesId: filter.trainingSeriesId,
    teamSeasonId: filter.teamSeasonId,
    status: filter.status,
    dateFrom: filter.dateFrom ? toDateOnlyUtc(filter.dateFrom) : undefined,
    dateTo: filter.dateTo ? toDateOnlyUtc(filter.dateTo) : undefined,
    includeInactive: filter.includeInactive,
  });
  return rows.map(toDto);
}

/**
 * Retrieves a single TrainingSession by id.
 *
 * @throws {TrainingSessionNotFoundError} Session not found or cross-tenant.
 */
export async function getTrainingSession(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionDto> {
  const row = await findTrainingSessionById(tenantId, sessionId);
  if (!row) {
    throw new TrainingSessionNotFoundError(sessionId);
  }
  return toDto(row);
}
