/**
 * lib/publishing/infoboard/screen1-feed-expiry.ts
 *
 * Screen-1 runtime expiry filtering for Infoboard feed DTOs.
 *
 * Applies effective-end semantics with a short post-event grace window
 * (SCREEN1_POST_EVENT_GRACE_MS) so players returning to the Kabine remain
 * guided briefly after training/match end.
 *
 * Pure functions only — no framework imports, no clock reads.
 */

import type {
  InfoboardScreen1Event,
  InfoboardScreen1Feed,
} from "../event-types";
import { getScreen1DisplayEndAt } from "./screen1-event-lifecycle";

/**
 * Returns true when the event's display end (effective end + grace) is
 * strictly after `now`. Expired at exactly grace end: now >= displayEnd → false.
 */
export function isScreen1EventActiveAt(
  event: InfoboardScreen1Event,
  now: Date,
): boolean {
  const displayEnd = getScreen1DisplayEndAt(event);
  return displayEnd.getTime() > now.getTime();
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
