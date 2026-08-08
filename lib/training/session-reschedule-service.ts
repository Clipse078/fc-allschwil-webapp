/**
 * lib/training/session-reschedule-service.ts
 *
 * TRAININGCENTER-02 — single-occurrence date/time exception handling: edit
 * the effective date and/or start/end time of ONE generated TrainingSession
 * without changing the recurring TrainingSeries it was generated from.
 *
 * This is the "genuinely missing" piece the schema doc comment on
 * TrainingSession already reserved room for: overrideDate/overrideStartAt/
 * overrideEndAt are additive, always-nullable columns that session-
 * generation-service.ts never reads from or writes to — regeneration keeps
 * resyncing the CANONICAL `date`/`startAt`/`endAt` against the series'
 * recurrence rule exactly as before (see session-generation-service.ts),
 * while this module owns the separate occurrence-level override that takes
 * display/consumer precedence (see toDto() in session-generation-service.ts).
 *
 * Deliberately does NOT flip TrainingSessionStatus to POSTPONED/MOVED: an
 * edited occurrence is still a genuine, upcoming training that needs a
 * pitch and a dressing room exactly like any other SCHEDULED occurrence —
 * flipping status would make assessTrainingOperationalState() treat it as
 * NOT_APPLICABLE ("Abgesagt"), which is wrong. Only cancelTrainingSession()
 * (session-lifecycle-service.ts) may make an occurrence NOT_APPLICABLE.
 *
 * Canonical principle preserved: the TrainingSeries recurrence definition,
 * and this TrainingSession's recurrence-slot identity (trainingSeriesId +
 * canonical `date`), are never mutated by a reschedule — only the
 * occurrence's override columns change. Re-running
 * generateTrainingSessions() for the series afterwards leaves the override
 * untouched and keeps resyncing the canonical schedule fields exactly as it
 * always has.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - findTrainingSessionById() is tenant-scoped; a cross-tenant id is
 *     treated as not found.
 */

import { TrainingSessionInvalidTransitionError, TrainingSessionNotFoundError, TrainingSessionRescheduleValidationError } from "./errors";
import { findTrainingSessionById, updateTrainingSessionOverride } from "./queries";
import { getTrainingSession } from "./session-generation-service";
import { dateKeyFromDate, toDateOnlyUtc, zonedTimeToUtc } from "./recurrence";
import type { RescheduleTrainingSessionInput, TrainingSessionDto } from "./types";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertValidTime(value: string, field: "startsAt" | "endsAt"): void {
  if (!TIME_PATTERN.test(value)) {
    throw new TrainingSessionRescheduleValidationError(`${field} must be a valid "HH:mm" time-of-day`);
  }
}

/**
 * Reschedules a single TrainingSession occurrence's effective date and/or
 * start/end time.
 *
 * `startsAt`/`endsAt` are always required (an edit form always submits the
 * full effective schedule). `date`, when omitted/null/blank, keeps the
 * occurrence on its canonical calendar date.
 *
 * Idempotent in the sense that matters operationally: if the resolved
 * effective date/time exactly equals the occurrence's canonical
 * (series-derived) schedule, any existing override is cleared rather than
 * stored redundantly — this is also how a caller "resets to the series
 * default" (submit the canonical values shown as the reference default).
 *
 * @throws {TrainingSessionNotFoundError} Session not found or cross-tenant.
 * @throws {TrainingSessionInvalidTransitionError} Session is not SCHEDULED
 *   (CANCELLED/RECURRENCE_REMOVED occurrences have nothing to reschedule;
 *   restore a cancelled session first).
 * @throws {TrainingSessionRescheduleValidationError} Invalid date/time format,
 *   or startsAt is not before endsAt.
 */
export async function rescheduleTrainingSession(
  tenantId: string,
  sessionId: string,
  input: RescheduleTrainingSessionInput,
): Promise<TrainingSessionDto> {
  const existing = await findTrainingSessionById(tenantId, sessionId);
  if (!existing) {
    throw new TrainingSessionNotFoundError(sessionId);
  }

  if (existing.status !== "SCHEDULED") {
    throw new TrainingSessionInvalidTransitionError(
      `Cannot reschedule a TrainingSession with status "${existing.status}"`,
    );
  }

  assertValidTime(input.startsAt, "startsAt");
  assertValidTime(input.endsAt, "endsAt");
  if (input.startsAt >= input.endsAt) {
    throw new TrainingSessionRescheduleValidationError("startsAt must be before endsAt");
  }

  const canonicalDateKey = dateKeyFromDate(existing.date);
  const requestedDate = input.date?.trim();
  const targetDateKey = requestedDate ? requestedDate : canonicalDateKey;

  if (requestedDate && !DATE_PATTERN.test(requestedDate)) {
    throw new TrainingSessionRescheduleValidationError('date must be a valid "YYYY-MM-DD" calendar date');
  }
  if (requestedDate && Number.isNaN(new Date(`${requestedDate}T00:00:00.000Z`).getTime())) {
    throw new TrainingSessionRescheduleValidationError('date must be a valid "YYYY-MM-DD" calendar date');
  }

  const newStartAt = zonedTimeToUtc(targetDateKey, input.startsAt, existing.timezone);
  const newEndAt = zonedTimeToUtc(targetDateKey, input.endsAt, existing.timezone);

  const matchesCanonicalSchedule =
    targetDateKey === canonicalDateKey &&
    newStartAt.getTime() === existing.startAt.getTime() &&
    newEndAt.getTime() === existing.endAt.getTime();

  if (matchesCanonicalSchedule) {
    await updateTrainingSessionOverride(sessionId, {
      overrideDate: null,
      overrideStartAt: null,
      overrideEndAt: null,
    });
  } else {
    await updateTrainingSessionOverride(sessionId, {
      overrideDate: targetDateKey === canonicalDateKey ? null : toDateOnlyUtc(new Date(`${targetDateKey}T00:00:00.000Z`)),
      overrideStartAt: newStartAt,
      overrideEndAt: newEndAt,
    });
  }

  return getTrainingSession(tenantId, sessionId);
}

/**
 * Clears any occurrence-level schedule override, reverting this
 * TrainingSession back to its TrainingSeries-derived default date/time.
 * Idempotent: clearing a session with no override is a no-op write.
 *
 * @throws {TrainingSessionNotFoundError} Session not found or cross-tenant.
 * @throws {TrainingSessionInvalidTransitionError} Session is not SCHEDULED.
 */
export async function resetTrainingSessionSchedule(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionDto> {
  const existing = await findTrainingSessionById(tenantId, sessionId);
  if (!existing) {
    throw new TrainingSessionNotFoundError(sessionId);
  }

  if (existing.status !== "SCHEDULED") {
    throw new TrainingSessionInvalidTransitionError(
      `Cannot reset a TrainingSession with status "${existing.status}"`,
    );
  }

  await updateTrainingSessionOverride(sessionId, {
    overrideDate: null,
    overrideStartAt: null,
    overrideEndAt: null,
  });

  return getTrainingSession(tenantId, sessionId);
}
