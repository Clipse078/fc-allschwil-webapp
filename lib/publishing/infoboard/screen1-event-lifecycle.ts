/**
 * lib/publishing/infoboard/screen1-event-lifecycle.ts
 *
 * Deterministic Screen-1 event lifecycle semantics (INFOBOARD-REGRESSION-01F).
 *
 * PRE-EVENT:   operationally relevant ~120 minutes before start.
 * CURRENT:     from start until effective end.
 * POST-EVENT:  short grace after end (default 15 minutes) for Kabine return.
 *
 * Pure functions only — callers supply `now` explicitly.
 */

import type { InfoboardScreen1Event } from "../event-types";
import { getEffectiveEndAt } from "../time/temporal-grouping";

/** Minutes before start when an event becomes operationally relevant on Screen 1. */
export const SCREEN1_PRE_EVENT_RELEVANCE_MINUTES = 120;

/** Minutes after effective end when a finished event may remain visible. */
export const SCREEN1_POST_EVENT_GRACE_MINUTES = 15;

export const SCREEN1_PRE_EVENT_RELEVANCE_MS =
  SCREEN1_PRE_EVENT_RELEVANCE_MINUTES * 60 * 1000;

export const SCREEN1_POST_EVENT_GRACE_MS =
  SCREEN1_POST_EVENT_GRACE_MINUTES * 60 * 1000;

export type Screen1LifecyclePhase = "pre-event" | "current" | "post-event-grace" | "expired";

function toTemporalShape(event: InfoboardScreen1Event): {
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly type: string;
} {
  return {
    startAt: new Date(event.startAt),
    endAt: event.endAt !== null ? new Date(event.endAt) : null,
    type: event.type,
  };
}

/**
 * Returns the lifecycle phase for a Screen-1 event at `now`.
 */
export function getScreen1LifecyclePhase(
  event: InfoboardScreen1Event,
  now: Date,
): Screen1LifecyclePhase {
  const startMs = new Date(event.startAt).getTime();
  const effectiveEndMs = getEffectiveEndAt(toTemporalShape(event)).getTime();
  const graceEndMs = effectiveEndMs + SCREEN1_POST_EVENT_GRACE_MS;
  const nowMs = now.getTime();

  if (nowMs >= graceEndMs) return "expired";
  if (nowMs >= effectiveEndMs) return "post-event-grace";
  if (nowMs >= startMs) return "current";
  if (nowMs >= startMs - SCREEN1_PRE_EVENT_RELEVANCE_MS) return "pre-event";
  return "pre-event";
}

/**
 * True when the event should be considered for Screen-1 display at `now`.
 * Events beyond pre-event relevance are still eligible as lower-priority
 * same-day fill candidates — see `isScreen1SameDayCandidateAt`.
 */
export function isScreen1LifecycleEligibleAt(
  event: InfoboardScreen1Event,
  now: Date,
): boolean {
  return getScreen1LifecyclePhase(event, now) !== "expired";
}

/**
 * True when an event is within the operational pre-event relevance window
 * (≤120 minutes before start) or currently active / in post-event grace.
 */
export function isScreen1OperationallyRelevantAt(
  event: InfoboardScreen1Event,
  now: Date,
): boolean {
  const phase = getScreen1LifecyclePhase(event, now);
  return phase !== "expired";
}

/**
 * Effective end including post-event grace — used for runtime feed filtering.
 */
export function getScreen1DisplayEndAt(event: InfoboardScreen1Event): Date {
  const effectiveEnd = getEffectiveEndAt(toTemporalShape(event));
  return new Date(effectiveEnd.getTime() + SCREEN1_POST_EVENT_GRACE_MS);
}
