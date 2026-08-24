/**
 * lib/publishing/infoboard/screen1-feed-expiry.ts
 *
 * Screen-1 runtime expiry filtering for Infoboard feed DTOs.
 *
 * Applies the same effective-end semantics as partitionByTemporalGroup():
 * an event is active while effectiveEnd > now (strict — no post-event grace).
 *
 * Pure functions only — no framework imports, no clock reads.
 */

import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "../event-types";
import { getEffectiveEndAt } from "../time/temporal-grouping";

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
 * Returns true when the event's effective end time is strictly after `now`.
 * Expired at exactly end time: now >= effectiveEnd → false.
 */
export function isScreen1EventActiveAt(
  event: InfoboardScreen1Event,
  now: Date,
): boolean {
  const effectiveEnd = getEffectiveEndAt(toTemporalShape(event));
  return effectiveEnd.getTime() > now.getTime();
}

function filterActiveEvents(
  events: readonly InfoboardScreen1Event[],
  now: Date,
): InfoboardScreen1Event[] {
  return events.filter((event) => isScreen1EventActiveAt(event, now));
}

/**
 * Removes expired events from all Screen-1 feed buckets.
 * Recomputes isEmpty; preserves emptyStateReason only when the filtered feed
 * is empty (for DAY_COMPLETED / NO_EVENTS_TODAY messaging).
 */
export function filterExpiredScreen1Feed(
  feed: InfoboardScreen1Feed,
  now: Date,
): InfoboardScreen1Feed {
  const current = filterActiveEvents(feed.current, now);
  const next = filterActiveEvents(feed.next, now);
  const later = filterActiveEvents(feed.later, now);

  const isEmpty = current.length === 0 && next.length === 0 && later.length === 0;

  return {
    ...feed,
    current,
    next,
    later,
    isEmpty,
    emptyStateReason: isEmpty ? feed.emptyStateReason : null,
  };
}
