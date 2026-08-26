/**
 * lib/publishing/infoboard/screen1-feed-builder.ts
 *
 * Reusable data-composition layer for Infoboard Screen 1.
 *
 * Composes PP-01A temporal grouping, PP-01B publication policy, PP-01C
 * presentation resolvers, and an injected event loader to build the
 * InfoboardScreen1Feed DTO.
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no logging.
 *   - `now` is always supplied by the caller — new Date() is never called.
 *   - IANA timezone is always supplied by the caller — server-local timezone
 *     is never used.
 *   - The loader is called exactly once.
 *   - Publication rules are not duplicated here; policy evaluation is
 *     delegated entirely to selectEventsForPublication().
 *   - Temporal grouping is not duplicated here; partitionByTemporalGroup()
 *     is called exactly once on the eligible event set.
 *   - Presentation fallback logic is not duplicated here; all naming and
 *     allocation resolution is delegated to the mapper.
 *   - No hidden date-window filtering beyond what the loader applies and
 *     what temporal grouping classifies.
 *   - Inputs and loaded events are not mutated.
 *   - Result arrays are always new arrays.
 *
 * Selection algorithm — rolling operational window (INFOBOARD-INTEGRATION-01B-C1):
 *   - current  — all events whose display interval spans now (no cap).
 *   - next     — the eligible upcoming events sharing the earliest startAt
 *                within the next SCREEN1_HORIZON_HOURS hours.
 *   - later    — remaining eligible upcoming events within the same rolling
 *                horizon, ordered by startAt ascending.
 *   - Events starting beyond the rolling horizon are not included, however
 *     many active events remain visible in "current" for their entire
 *     duration regardless of when they started.
 *   - emptyStateReason — "DAY_COMPLETED" when events existed today but all
 *                ended; "NO_EVENTS_TODAY" when no eligible events exist for
 *                the evaluated local calendar day.
 */

import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  InfoboardTenantRef,
  EmptyStateReason,
} from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import { selectEventsForPublication } from "../policy/event-selection";
import {
  getEffectiveEndAt,
  partitionByTemporalGroup,
  toLocalDateKey,
} from "../time/temporal-grouping";
import { SCREEN1_POST_EVENT_GRACE_MS } from "./screen1-event-lifecycle";
import { mapScreen1Event } from "./screen1-event-mapper";
import type { Screen1SourceEvent } from "./screen1-event-mapper";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Rolling operational look-ahead window, in hours, for upcoming ("next" /
 * "later") activities. Screen 1 shows operational activity for approximately
 * the next 3–4 hours; upcoming activities starting beyond this window are not
 * shown. Active events ("current") are never subject to this cutoff — once
 * visible, they remain visible until they end.
 *
 * This is a fixed operational constant, not a per-tenant setting.
 *
 * Exported so Infoboard Screen 2 (INFOBOARD-INTEGRATION-01C) reuses the
 * exact same rolling operational horizon for its per-facility current/next
 * resolution instead of defining a second, divergent window.
 */
export const SCREEN1_HORIZON_HOURS = 4;

/** SCREEN1_HORIZON_HOURS expressed in milliseconds for use with `Date` math. */
export const SCREEN1_HORIZON_MS = SCREEN1_HORIZON_HOURS * 60 * 60 * 1000;

/**
 * Minimum rendered display cards when the rolling window is sparse.
 * Fill-forward logic never splits a same-start temporal cohort.
 */
export const MIN_DISPLAY_CARDS = 3;

/**
 * Selects fill-forward events while preserving same-start temporal cohort
 * integrity. Candidates must be pre-sorted by startAt ascending.
 *
 * When a cohort is included, every event sharing that startAt is included —
 * even if the cohort size exceeds the remaining fill budget.
 */
export function selectFillEventsPreservingStartCohorts<T extends { startAt: Date }>(
  candidates: readonly T[],
  needed: number,
): T[] {
  if (needed <= 0 || candidates.length === 0) return [];

  const cohorts: T[][] = [];
  for (const event of candidates) {
    const lastCohort = cohorts[cohorts.length - 1];
    if (
      lastCohort !== undefined &&
      lastCohort[0].startAt.getTime() === event.startAt.getTime()
    ) {
      lastCohort.push(event);
    } else {
      cohorts.push([event]);
    }
  }

  const fillEvents: T[] = [];
  let fillCount = 0;
  for (const cohort of cohorts) {
    if (fillCount >= needed) break;
    fillEvents.push(...cohort);
    fillCount += cohort.length;
  }

  return fillEvents;
}

// ── Feed builder input ─────────────────────────────────────────────────────────

/**
 * Input for buildInfoboardScreen1Feed.
 *
 * - `tenant`: full tenant reference including IANA timezone.
 * - `timeZone`: IANA timezone string used for temporal grouping and the
 *   display-date key. Must be valid; invalid values throw RangeError.
 * - `now`: the reference moment for temporal classification and generatedAt.
 *   The caller is responsible for supplying the current time.
 * - `dateFrom` / `dateTo`: forwarded to the loader as-is; the builder
 *   does not apply a second date filter.
 * - `seasonKey` / `teamSlug`: forwarded to the loader as-is.
 */
export type BuildScreen1FeedInput = {
  readonly tenant: InfoboardTenantRef;
  readonly timeZone: string;
  readonly now: Date;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly seasonKey?: string;
  readonly teamSlug?: string;
  /** Tenant club logo for own-team crest resolution (Tenant.logoUrl). */
  readonly tenantLogoUrl?: string | null;
};

// ── buildInfoboardScreen1Feed ──────────────────────────────────────────────────

/**
 * Builds a complete InfoboardScreen1Feed by:
 *
 *  1. Validating the supplied IANA timezone (RangeError on invalid).
 *  2. Calling selectEventsForPublication() with channel INFOBOARD_SCREEN_1
 *     exactly once; this internally calls the injected loader exactly once.
 *  3. Discarding rejected events.
 *  4. Partitioning eligible events into temporal groups via
 *     partitionByTemporalGroup(), bounded by a fixed SCREEN1_HORIZON_HOURS
 *     (4 hour) rolling look-ahead window instead of the calendar-day default:
 *       - "current" — active events (no cap, no cutoff).
 *       - "next"    — upcoming eligible events sharing the earliest startAt
 *                     within the rolling horizon.
 *       - "later"   — remaining upcoming eligible events within the same
 *                     rolling horizon.
 *     Events starting beyond the horizon are excluded entirely; an event
 *     already active when the horizon is computed remains visible in
 *     "current" for its full duration, regardless of when it started.
 *  5. Determining the empty-state reason:
 *     - DAY_COMPLETED when eligible events existed for today but all ended.
 *     - NO_EVENTS_TODAY when no eligible events exist for today at all.
 *  6. Mapping each event through mapScreen1Event().
 *  7. Assembling and returning the InfoboardScreen1Feed.
 *
 * The loader receives: tenantId, dateFrom, dateTo, seasonKey, teamSlug.
 * The loader does NOT receive: channel, timezone, now, tenant display metadata.
 *
 * Loader errors propagate unchanged. No retry, no partial feed on error.
 * Invalid timezone throws RangeError from toLocalDateKey before the loader
 * is called.
 *
 * @throws {RangeError} When `input.timeZone` is not a valid IANA identifier.
 * @throws Any error thrown by `loadEvents`.
 */
export async function buildInfoboardScreen1Feed(
  loadEvents: PublicationEventLoader<Screen1SourceEvent>,
  input: BuildScreen1FeedInput,
): Promise<InfoboardScreen1Feed> {
  // Step 1: Validate timezone eagerly. toLocalDateKey throws RangeError for
  // invalid IANA identifiers and also produces the display-date key we need.
  const displayDate = toLocalDateKey(input.now, input.timeZone);

  // Step 2: Load events through the policy selector.
  // selectEventsForPublication calls loadEvents exactly once.
  const selection = await selectEventsForPublication(loadEvents, {
    tenantId: input.tenant.id,
    channel: "INFOBOARD_SCREEN_1",
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    seasonKey: input.seasonKey,
    teamSlug: input.teamSlug,
  });

  // Step 3: Partition eligible events into temporal buckets, bounded by the
  // fixed rolling operational horizon (SCREEN1_HORIZON_MS) instead of the
  // calendar-day default. partitionByTemporalGroup produces:
  //   grouped.current — active events (startAt <= now, effectiveEnd > now);
  //                     never subject to the horizon cutoff.
  //   grouped.next    — upcoming events at the earliest startAt within the
  //                     horizon.
  //   grouped.later   — remaining upcoming events within the same horizon.
  // Events starting beyond the horizon are simply absent from every bucket.
  const grouped = partitionByTemporalGroup(
    selection.eligible,
    input.now,
    input.timeZone,
    { horizonMs: SCREEN1_HORIZON_MS },
  );

  // Step 3b: Minimum-card fill — DISPLAY-WINDOW-V2
  //
  // Rules (task spec §17):
  //   1. Always include currently running activities.
  //   2. Include upcoming activities within the next SCREEN1_HORIZON_HOURS hours.
  //   3. If this produces fewer than MIN_DISPLAY_CARDS rendered display cards,
  //      fill forward with the next upcoming activities later today.
  //   4. Continue only up to normal display capacity.
  //   5. Never reintroduce completed activities.
  //   6. If no activities remain today, use empty state.
  //
  // "Grouped trainings count as one rendered card" — approximated here by
  // counting eligible events in the fill bucket; the TrainingGroupCard
  // grouping happens in the component. We fill based on event count and let
  // the component collapse same-start trainings.
  //
  // This ensures a board at 09:00 is not empty when the first training starts
  // at 16:00 — it shows the next relevant activities of the day.

  const windowEventCount =
    grouped.current.length + grouped.next.length + grouped.later.length;

  let fillEvents: (typeof selection.eligible)[number][] = [];
  let capacityFillEvents: (typeof selection.eligible)[number][] = [];

  if (windowEventCount < MIN_DISPLAY_CARDS) {
    // Count how many rendered cards we already have
    // (approximate: current + next group as 1 + each later)
    const alreadyShown = new Set([
      ...grouped.current.map((e) => e.id),
      ...grouped.next.map((e) => e.id),
      ...grouped.later.map((e) => e.id),
    ]);

    // Find upcoming events today that are NOT already shown and have NOT completed
    const todayFillCandidates = selection.eligible
      .filter((e) => {
        if (alreadyShown.has(e.id)) return false;
        // Only future events (not completed)
        if (e.startAt <= input.now) return false;
        if (getEffectiveEndAt(e).getTime() <= input.now.getTime()) return false;
        // Only today
        return toLocalDateKey(e.startAt, input.timeZone) === displayDate;
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    // Fill up to MIN_DISPLAY_CARDS total without splitting same-start cohorts.
    const needed = MIN_DISPLAY_CARDS - windowEventCount;
    fillEvents = selectFillEventsPreservingStartCohorts(
      todayFillCandidates,
      Math.max(0, needed),
    );

    // Step 3c: Same-day capacity candidates (INFOBOARD-REGRESSION-01F)
    //
    // When the rolling horizon is sparse, include ALL remaining same-day events
    // that have not yet passed display end (+ grace) so UI admission can fill
    // available viewport capacity with complete cohorts.
    const alreadyInWindow = new Set([
      ...grouped.current.map((event) => event.id),
      ...grouped.next.map((event) => event.id),
      ...grouped.later.map((event) => event.id),
      ...fillEvents.map((event) => event.id),
    ]);

    const sameDayCapacityCandidates = selection.eligible
      .filter((event) => {
        if (alreadyInWindow.has(event.id)) return false;
        if (toLocalDateKey(event.startAt, input.timeZone) !== displayDate) {
          return false;
        }
        const effectiveEndMs = getEffectiveEndAt(event).getTime();
        const displayEndMs = effectiveEndMs + SCREEN1_POST_EVENT_GRACE_MS;
        if (displayEndMs <= input.now.getTime()) return false;
        return event.startAt.getTime() > input.now.getTime();
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    capacityFillEvents = selectFillEventsPreservingStartCohorts(
      sameDayCapacityCandidates,
      sameDayCapacityCandidates.length,
    );
  }

  // Step 4: Determine empty-state reason before mapping.
  // Check whether any eligible event falls on today's local calendar day,
  // regardless of whether it has already ended (used for DAY_COMPLETED).
  // This is independent of the rolling horizon — it only affects the
  // human-readable reason shown for an empty board, never which events
  // are displayed.
  const isEmpty =
    grouped.current.length === 0 &&
    grouped.next.length === 0 &&
    grouped.later.length === 0 &&
    fillEvents.length === 0 &&
    capacityFillEvents.length === 0;

  let emptyStateReason: EmptyStateReason | null = null;
  if (isEmpty) {
    const hadEventsToday = selection.eligible.some(
      (e) => toLocalDateKey(e.startAt, input.timeZone) === displayDate,
    );
    emptyStateReason = hadEventsToday ? "DAY_COMPLETED" : "NO_EVENTS_TODAY";
  }

  // Step 5: Map each bucket's events to DTOs.
  const current: InfoboardScreen1Event[] = grouped.current.map((event) =>
    mapScreen1Event({
      event,
      temporalBucket: "current",
      tenantClubName: input.tenant.name,
      tenantLogoUrl: input.tenantLogoUrl,
    }),
  );

  const next: InfoboardScreen1Event[] = grouped.next.map((event) =>
    mapScreen1Event({
      event,
      temporalBucket: "next",
      tenantClubName: input.tenant.name,
      tenantLogoUrl: input.tenantLogoUrl,
    }),
  );

  const later: InfoboardScreen1Event[] = [
    ...grouped.later,
    ...fillEvents,
    ...capacityFillEvents,
  ].map((event) =>
    mapScreen1Event({
      event,
      temporalBucket: "later",
      tenantClubName: input.tenant.name,
      tenantLogoUrl: input.tenantLogoUrl,
    }),
  );

  // Step 6: Assemble the feed.
  return {
    generatedAt: input.now.toISOString(),
    tenant: input.tenant,
    displayDate,
    isStale: false,
    wochenplanVariantBadge: null,
    current,
    next,
    later,
    isEmpty,
    emptyStateReason,
  };
}
