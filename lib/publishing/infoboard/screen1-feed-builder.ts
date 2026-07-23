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
 */

import type {
  InfoboardScreen1Feed,
  InfoboardScreen1Event,
  InfoboardTenantRef,
} from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import { selectEventsForPublication } from "../policy/event-selection";
import {
  partitionByTemporalGroup,
  toLocalDateKey,
} from "../time/temporal-grouping";
import { mapScreen1Event } from "./screen1-event-mapper";
import type { Screen1SourceEvent } from "./screen1-event-mapper";

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
 *  4. Partitioning eligible events into current / next / later buckets via
 *     partitionByTemporalGroup().
 *  5. Mapping each event through mapScreen1Event().
 *  6. Assembling and returning the InfoboardScreen1Feed.
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

  // Step 3: Partition eligible events into temporal buckets.
  const grouped = partitionByTemporalGroup(
    selection.eligible,
    input.now,
    input.timeZone,
  );

  // Step 4: Map each bucket's events to DTOs.
  const current: InfoboardScreen1Event[] = grouped.current.map((event) =>
    mapScreen1Event({ event, temporalBucket: "current" }),
  );

  const next: InfoboardScreen1Event[] = grouped.next.map((event) =>
    mapScreen1Event({ event, temporalBucket: "next" }),
  );

  const later: InfoboardScreen1Event[] = grouped.later.map((event) =>
    mapScreen1Event({ event, temporalBucket: "later" }),
  );

  // Step 5: Assemble the feed.
  return {
    generatedAt: input.now.toISOString(),
    tenant: input.tenant,
    displayDate,
    isStale: false,
    wochenplanVariantBadge: null,
    current,
    next,
    later,
    isEmpty: current.length === 0 && next.length === 0 && later.length === 0,
  };
}
