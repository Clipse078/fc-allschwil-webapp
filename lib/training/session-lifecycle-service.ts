/**
 * lib/training/session-lifecycle-service.ts
 *
 * TRAININGCENTER-01 — single-occurrence exception handling for canonical
 * TrainingSessions: cancelling (and restoring) one dated occurrence without
 * touching its parent TrainingSeries.
 *
 * This is the "proven gap" the STEP 6 (Recurring Training UX) inventory
 * identified: TrainingSession.status already models CANCELLED at the
 * schema level (see the TrainingSessionStatus doc comment in
 * schema.prisma), and session-generation-service.ts already guarantees
 * regeneration never overwrites a CANCELLED row — but no service ever
 * actually *wrote* CANCELLED before this module.
 *
 * Deliberately narrow scope: cancel / restore only. Rescheduling a single
 * occurrence's date/time/allocation independently of its series (POSTPONED
 * / MOVED) is explicitly out of scope — the schema doc comment describes
 * that as a future `TrainingSessionWeekplanOverride` model, which does not
 * exist yet and is not introduced here (see PR notes / known limitations).
 *
 * Canonical principle preserved: the TrainingSeries recurrence definition
 * is never mutated by a cancellation — only the single TrainingSession row
 * changes status. Re-running generateTrainingSessions() for the series
 * afterwards leaves the CANCELLED row untouched (already covered by
 * session-generation-service.ts's existing regeneration tests).
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - findTrainingSessionById() is tenant-scoped; a cross-tenant id is
 *     treated as not found.
 */

import {
  TrainingSessionInvalidTransitionError,
  TrainingSessionNotFoundError,
} from "./errors";
import { findTrainingSessionById, updateTrainingSessionStatus } from "./queries";
import { getTrainingSession } from "./session-generation-service";
import type { TrainingSessionDto } from "./types";

/**
 * Cancels a single TrainingSession occurrence.
 *
 * Only a SCHEDULED session can be cancelled. Cancelling an
 * already-CANCELLED session is idempotent (returns the unchanged DTO).
 *
 * @throws {TrainingSessionNotFoundError} Session not found or cross-tenant.
 * @throws {TrainingSessionInvalidTransitionError} Session is POSTPONED, MOVED,
 *   or RECURRENCE_REMOVED — not a genuine SCHEDULED occurrence to cancel.
 */
export async function cancelTrainingSession(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionDto> {
  const existing = await findTrainingSessionById(tenantId, sessionId);
  if (!existing) {
    throw new TrainingSessionNotFoundError(sessionId);
  }

  if (existing.status === "CANCELLED") {
    return getTrainingSession(tenantId, sessionId);
  }

  if (existing.status !== "SCHEDULED") {
    throw new TrainingSessionInvalidTransitionError(
      `Cannot cancel a TrainingSession with status "${existing.status}"`,
    );
  }

  await updateTrainingSessionStatus(sessionId, "CANCELLED");
  return getTrainingSession(tenantId, sessionId);
}

/**
 * Restores a previously-CANCELLED TrainingSession occurrence back to
 * SCHEDULED. Restoring a session that is already SCHEDULED is idempotent
 * (returns the unchanged DTO).
 *
 * @throws {TrainingSessionNotFoundError} Session not found or cross-tenant.
 * @throws {TrainingSessionInvalidTransitionError} Session is not CANCELLED
 *   (and not already SCHEDULED) — nothing to restore.
 */
export async function restoreTrainingSession(
  tenantId: string,
  sessionId: string,
): Promise<TrainingSessionDto> {
  const existing = await findTrainingSessionById(tenantId, sessionId);
  if (!existing) {
    throw new TrainingSessionNotFoundError(sessionId);
  }

  if (existing.status === "SCHEDULED") {
    return getTrainingSession(tenantId, sessionId);
  }

  if (existing.status !== "CANCELLED") {
    throw new TrainingSessionInvalidTransitionError(
      `Cannot restore a TrainingSession with status "${existing.status}"`,
    );
  }

  await updateTrainingSessionStatus(sessionId, "SCHEDULED");
  return getTrainingSession(tenantId, sessionId);
}
