/**
 * Stable identity keys for Screen-1 Studio per-card overrides.
 *
 * Keys must survive refreshes, time advances, and event expiry without using
 * array index or page numbers.
 */

import type { DisplayItem } from "@/components/infoboard/screen1/InfoboardScreen1";

/** Prefix for same-start training cohort cards. */
export const TRAINING_COHORT_KEY_PREFIX = "cohort:training:";

/**
 * Stable key for a training cohort identified by shared startAt ISO string.
 */
export function trainingCohortKey(startAt: string): string {
  return `${TRAINING_COHORT_KEY_PREFIX}${startAt}`;
}

/**
 * Stable key for a single-event card (match, tournament, solo training).
 * Uses the canonical InfoboardScreen1Event.id (e.g. match:…, tournament:…).
 */
export function eventCardKey(eventId: string): string {
  return eventId;
}

/**
 * Resolves the stable override key for a rendered DisplayItem.
 * Training cohorts (including continuation chunks) share the cohort key.
 */
export function resolveDisplayItemKey(item: DisplayItem): string {
  if (item.kind === "training-group") {
    return trainingCohortKey(item.items[0]!.event.startAt);
  }
  return eventCardKey(item.item.event.id);
}

/**
 * Human-readable label for Studio UI card list entries.
 */
export function resolveDisplayItemLabel(item: DisplayItem): string {
  if (item.kind === "training-group") {
    const count = item.items.length;
    const firstName =
      item.items[0]?.event.teamDisplayName ??
      item.items[0]?.event.displayTitle ??
      "Training";
    if (count === 1) return firstName;
    return `${firstName} (+${count - 1})`;
  }
  const event = item.item.event;
  if (event.type === "MATCH") {
    return event.teamDisplayName ?? event.displayTitle ?? "Spiel";
  }
  if (event.type === "TOURNAMENT") {
    return event.displayTitle ?? "Turnier";
  }
  return event.teamDisplayName ?? event.displayTitle ?? event.type;
}
