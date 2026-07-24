/**
 * lib/publishing/infoboard/screen2-feed-builder.ts
 *
 * Reusable data-composition layer for Infoboard Screen 2.
 *
 * Orchestrates the full Screen 2 pipeline:
 *
 *   Database
 *     ↓
 *   Screen2 Source Loader (createScreen2SourceLoader / createScreen2FacilityResourceLoader)
 *     ↓
 *   Publication Selection (INFOBOARD_SCREEN_2 channel)
 *     ↓
 *   Resource Normalization (normalizeScreen2Resources)
 *     ↓
 *   Screen2 Event Mapper (mapAllScreen2Events)
 *     ↓
 *   Occupancy Resolver (resolveScreen2Occupancy)
 *     ↓
 *   Feed Assembly
 *
 * Design constraints:
 *   - No Prisma imports, no DB access, no Next.js, no React.
 *   - No environment variable access, no logging.
 *   - `now` is always supplied by the caller — new Date() is never called.
 *   - IANA timezone is always supplied by the caller.
 *   - The event loader is called exactly once.
 *   - The resource loader is called exactly once.
 *   - Publication policy is not duplicated; delegated entirely to
 *     selectEventsForPublication() with channel INFOBOARD_SCREEN_2.
 *   - Temporal logic is not duplicated; getEffectiveEndAt and isLocalToday
 *     from temporal-grouping are called through the occupancy resolver.
 *   - The same `now` flows through the complete pipeline without replacement.
 *   - Inputs and loaded events are not mutated.
 *   - Result arrays are always new arrays.
 *
 * Source query window:
 *   The builder constructs a UTC safety window that spans the full tenant-local
 *   calendar day of `now`. The window is widened by ±24 hours to ensure events
 *   that started before UTC midnight but are still running are included, and
 *   that events starting near the end of the local day are not missed at
 *   timezone boundaries. The occupancy resolver filters to today's local date
 *   and current/upcoming events after loading.
 */

import type { InfoboardTenantRef } from "../event-types";
import type { PublicationEventLoader } from "../policy/event-selection";
import type { Screen2FacilityResourceRow } from "./screen2-resource-normalizer";
import type {
  Screen2SourceEvent,
  InfoboardScreen2Feed,
  InfoboardScreen2Diagnostics,
} from "./screen2-types";
import { selectEventsForPublication } from "../policy/event-selection";
import {
  normalizeScreen2Resources,
  buildResourcesByCode,
} from "./screen2-resource-normalizer";
import { mapAllScreen2Events } from "./screen2-event-mapper";
import { resolveScreen2Occupancy } from "./screen2-occupancy-resolver";
import { toLocalDateKey } from "../time/temporal-grouping";

// ── Feed builder input ─────────────────────────────────────────────────────────

/**
 * Input for buildInfoboardScreen2Feed.
 *
 * - `tenant`: full tenant reference including IANA timezone.
 * - `timeZone`: IANA timezone string. Must match tenant.timezone; validated
 *   eagerly via toLocalDateKey (throws RangeError for invalid identifiers).
 * - `now`: reference moment for all occupancy and display-date calculations.
 * - `loadFacilityResources`: loader that returns all FacilityResource rows for
 *   the tenant. Called exactly once.
 */
export type BuildScreen2FeedInput = {
  readonly tenant: InfoboardTenantRef;
  readonly timeZone: string;
  readonly now: Date;
  readonly loadFacilityResources: () => Promise<ReadonlyArray<Screen2FacilityResourceRow>>;
};

// ── UTC safety window ──────────────────────────────────────────────────────────

/**
 * Computes a UTC date window wide enough to capture all events on the tenant-local
 * calendar day of `now`, regardless of timezone offset.
 *
 * The window is: [now - 25h, now + 25h]
 * This accommodates the largest IANA timezone offset (UTC+14 / UTC-12) plus
 * a 1-hour margin for events with long effective durations starting late.
 *
 * The occupancy resolver filters to today's local date and current/future
 * events after loading — the window is intentionally over-inclusive.
 */
function computeQueryWindow(now: Date): { dateFrom: Date; dateTo: Date } {
  const MARGIN_MS = 25 * 60 * 60 * 1000; // 25 hours
  return {
    dateFrom: new Date(now.getTime() - MARGIN_MS),
    dateTo: new Date(now.getTime() + MARGIN_MS),
  };
}

// ── Resource name map ──────────────────────────────────────────────────────────

/**
 * Builds a code → name lookup map from ALL facility resources (including
 * dressing rooms) for use in dressing-room label resolution.
 */
function buildAllResourceNameByCode(
  rows: ReadonlyArray<Screen2FacilityResourceRow>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.code && !map.has(row.code)) {
      map.set(row.code, row.name);
    }
  }
  return map;
}

// ── buildInfoboardScreen2Feed ──────────────────────────────────────────────────

/**
 * Builds a complete InfoboardScreen2Feed.
 *
 * Steps:
 *  1. Validate timezone (toLocalDateKey throws RangeError for invalid tz).
 *  2. Load facility resources (called exactly once).
 *  3. Load and select events via INFOBOARD_SCREEN_2 publication policy.
 *  4. Normalize display resources (exclude dressing rooms, archived, inactive).
 *  5. Map eligible events to allocation candidates.
 *  6. Resolve occupancy per display field.
 *  7. Assemble and return the feed with diagnostics.
 *
 * @throws {RangeError} When `input.timeZone` is not a valid IANA identifier.
 * @throws Any error thrown by `loadEvents` or `loadFacilityResources`.
 */
export async function buildInfoboardScreen2Feed(
  loadEvents: PublicationEventLoader<Screen2SourceEvent>,
  input: BuildScreen2FeedInput,
): Promise<InfoboardScreen2Feed> {
  // Step 1: Validate timezone eagerly.
  const displayDate = toLocalDateKey(input.now, input.timeZone);

  // Step 2: Load facility resources.
  const allResourceRows = await input.loadFacilityResources();
  const resourceNameByCode = buildAllResourceNameByCode(allResourceRows);

  // Step 3: Compute query window and load + select events.
  const { dateFrom, dateTo } = computeQueryWindow(input.now);

  const selection = await selectEventsForPublication(loadEvents, {
    tenantId: input.tenant.id,
    channel: "INFOBOARD_SCREEN_2",
    dateFrom,
    dateTo,
  });

  const sourceEventCount = selection.eligible.length + selection.rejected.length;
  const eligibleEventCount = selection.eligible.length;

  // Step 4: Normalize display resources.
  const displayResources = normalizeScreen2Resources(allResourceRows);

  // Step 5: Map eligible events to allocation candidates.
  const { candidates, unassignedIds } = mapAllScreen2Events(
    selection.eligible,
    {
      displayResources,
      timeZone: input.timeZone,
      resourceNameByCode,
    },
  );

  // Step 6: Resolve occupancy.
  const fields = resolveScreen2Occupancy({
    displayResources,
    candidates,
    now: input.now,
    timeZone: input.timeZone,
  });

  // Step 7: Assemble diagnostics.
  const conflictingFields = fields.filter((f) => f.conflictCount > 0);
  const diagnostics: InfoboardScreen2Diagnostics = {
    sourceEventCount,
    eligibleEventCount,
    mappedAllocationCount: candidates.length,
    fieldCount: fields.length,
    unassignedEventCount: unassignedIds.length,
    conflictingFieldCount: conflictingFields.length,
    unassignedEventIds: [...unassignedIds].sort(),
    conflictingFieldResourceIds: conflictingFields.map((f) => f.resourceId).sort(),
  };

  return {
    generatedAt: input.now.toISOString(),
    tenant: input.tenant,
    displayDate,
    timeZone: input.timeZone,
    isStale: false,
    fields,
    diagnostics,
  };
}
