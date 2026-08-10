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
  partitionByTemporalGroup,
  toLocalDateKey,
} from "../time/temporal-grouping";
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
 */
const SCREEN1_HORIZON_HOURS = 4;

/** SCREEN1_HORIZON_HOURS expressed in milliseconds for use with `Date` math. */
const SCREEN1_HORIZON_MS = SCREEN1_HORIZON_HOURS * 60 * 60 * 1000;

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

  // Step 4: Determine empty-state reason before mapping.
  // Check whether any eligible event falls on today's local calendar day,
  // regardless of whether it has already ended (used for DAY_COMPLETED).
  // This is independent of the rolling horizon — it only affects the
  // human-readable reason shown for an empty board, never which events
  // are displayed.
  const isEmpty =
    grouped.current.length === 0 &&
    grouped.next.length === 0 &&
    grouped.later.length === 0;

  let emptyStateReason: EmptyStateReason | null = null;
  if (isEmpty) {
    const hadEventsToday = selection.eligible.some(
      (e) => toLocalDateKey(e.startAt, input.timeZone) === displayDate,
    );
    emptyStateReason = hadEventsToday ? "DAY_COMPLETED" : "NO_EVENTS_TODAY";
  }

  // Step 5: Map each bucket's events to DTOs.
  const current: InfoboardScreen1Event[] = grouped.current.map((event) =>
    mapScreen1Event({ event, temporalBucket: "current" }),
  );

  const next: InfoboardScreen1Event[] = grouped.next.map((event) =>
    mapScreen1Event({ event, temporalBucket: "next" }),
  );

  const later: InfoboardScreen1Event[] = grouped.later.map((event) =>
    mapScreen1Event({ event, temporalBucket: "later" }),
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
