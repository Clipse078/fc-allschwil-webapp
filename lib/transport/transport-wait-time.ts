/**
 * lib/transport/transport-wait-time.ts
 *
 * Semantic wait-time hierarchy for Infoboard transport departures.
 */

export const WAIT_TIME_SOON_MAX_MINUTES = 5;
export const WAIT_TIME_MEDIUM_MAX_MINUTES = 15;

export type WaitTimeTone = "soon" | "medium" | "long";

export function computeMinutesUntil(effectiveMs: number, nowMs: number): number {
  if (!Number.isFinite(effectiveMs) || !Number.isFinite(nowMs)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.round((effectiveMs - nowMs) / 60_000));
}

/**
 * Map a relative wait in whole minutes to a semantic tone.
 *
 * 0–5 min  -> soon (green)
 * 6–15 min -> medium (amber)
 * 16+ min  -> long (neutral)
 */
export function resolveWaitTimeTone(minutesUntil: number): WaitTimeTone {
  if (minutesUntil <= WAIT_TIME_SOON_MAX_MINUTES) {
    return "soon";
  }

  if (minutesUntil <= WAIT_TIME_MEDIUM_MAX_MINUTES) {
    return "medium";
  }

  return "long";
}

export function formatRelativeWaitLabel(minutesUntil: number): string {
  return minutesUntil <= 0 ? "Jetzt" : `${minutesUntil} min`;
}
