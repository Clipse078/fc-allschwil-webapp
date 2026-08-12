/**
 * lib/publishing/infoboard/canonical-source-loader.ts
 *
 * INFOBOARD-INTEGRATION-01A — Canonical Planning Source Foundation.
 *
 * Replaces the legacy Event-table PublicationEventLoader (see
 * screen1-source-loader.ts) for Infoboard Screen 1 / Screen 2 with a loader
 * backed by the SAME canonical planning aggregation Weekplanner / Day
 * Planning already resolve:
 *
 *   getOperationalWeekplannerPlan(tenantId, weekId)  (lib/weekplanner/plan-service.ts)
 *     -> null                => Standardplan is operationally active
 *     -> WeekplannerPlanDto  => that plan is operationally active
 *   getWeekplannerDay(tenantId, dayWindow, planId)   (lib/weekplanner/queries.ts)
 *     -> that day's already fully-resolved TrainingSession / HOME Match /
 *        HOME Tournament WeekplannerItems, in EFFECTIVE (plan-overridden,
 *        else canonical Standardplan) time and Spielfeld/Halle/Garderobe
 *        resources.
 *
 * This is the ONLY plan resolution Infoboard performs. It never chooses the
 * newest plan, the first plan, a viewer's `?plan=` query, or an arbitrary
 * non-archived plan — only the persisted operational activation
 * (getOperationalWeekplannerPlan) determines which plan's effective state
 * is used, exactly per the canonical operational resolution algorithm:
 *
 *   1. resolve the requested date's canonical week (resolveTrainingWeekWindow)
 *   2. getOperationalWeekplannerPlan(tenantId, weekId)
 *   3. null  -> Standardplan (getWeekplannerDay with no planId)
 *      plan  -> that plan's effective state (getWeekplannerDay with planId)
 *   4. read the day's already-resolved effective WeekplannerItems
 *
 * No TrainingSession / TrainingAllocation / TournamentResourceAllocation /
 * WeekplannerPlanAllocation query is ever performed directly here — every
 * activity's time and resource allocation comes straight from the
 * WeekplannerItem Weekplanner already resolved. Duplicating that resolution
 * here would create a second planning engine, which is prohibited.
 *
 * What THIS module adds on top of a WeekplannerItem — deliberately NOT
 * carried by WeekplannerItem, because it is publication-policy / display
 * metadata, not planning data:
 *
 *   - TRAINING: no infoboardVisible-equivalent flag exists on TrainingSession
 *     or TrainingSeries. Canonical TrainingSessions are therefore Infoboard-
 *     eligible BY DEFAULT — a legacy Event(type=TRAINING) row is never read
 *     by this loader, and is never required to make a TrainingSession
 *     visible. Only the session's own operational status
 *     (TrainingSession.status) is read, to preserve cancellation behaviour
 *     (CANCELLED sessions are excluded by the existing, unmodified
 *     publication policy's STATUS_NOT_PUBLISHABLE check — see
 *     lib/publishing/policy/publication-policy.ts).
 *   - MATCH / TOURNAMENT: infoboardVisible / websiteVisible /
 *     trainingsplanVisible / status / homeAway / organizerName /
 *     competitionLabel / meetingTime / resultLabel / intermediateResultLabel
 *     already live on the underlying Event row that Weekplanner itself
 *     resolved `eventId` from (lib/matchcenter/query-service.ts /
 *     lib/tournaments/tournament-service.ts are both Event-backed). Reading
 *     those columns by id is a publication-metadata lookup keyed off an id
 *     Weekplanner already decided belongs to this day — never an
 *     independent "which matches/tournaments happened today" resolution.
 *
 * The mapped Screen1SourceEvent objects are then run through the EXISTING,
 * unmodified publication policy (selectEventsForPublication /
 * evaluatePublication) and feed builders (screen1-feed-builder.ts /
 * screen2-feed-builder.ts) — no policy or temporal-grouping logic is
 * duplicated here.
 *
 * Design constraints:
 *   - No direct Prisma import for policy-metadata reads: injected via
 *     CanonicalInfoboardPolicyDatabase, mirroring screen1-source-loader.ts's
 *     Screen1SourceDatabase convention (callers wire up the Prisma client at
 *     the route/page composition boundary; tests supply mocks).
 *   - getOperationalWeekplannerPlan / getWeekplannerDay are imported and
 *     called directly — the same convention every other Weekplanner/Day-
 *     Planning consumer already uses (e.g.
 *     app/(admin)/dashboard/planner/day/page.tsx). Prisma access for
 *     planning data is entirely Weekplanner's concern and is not duplicated
 *     here.
 *   - tenantId is always the caller-supplied, server-derived tenantId from
 *     PublicationEventLoadInput — never trusted client input. Every query
 *     below (policy metadata AND the underlying Weekplanner calls) is
 *     scoped to it.
 *   - Inputs are never mutated. Result arrays are always new arrays.
 *
 * Known, deliberate limitations (see INFOBOARD-INTEGRATION-01A final report):
 *   - `teamSlug` filtering (part of PublicationEventLoadInput, unused by any
 *     current Infoboard call site) is not supported — a WeekplannerItem
 *     carries only a resolved team display name, not a Team.slug. Adding
 *     this would require an additional join with no current caller.
 *   - A multi-day TOURNAMENT is bucketed under its effective START day only
 *     — this is existing, unmodified Weekplanner/Day-Planning bucketing
 *     behaviour (lib/weekplanner/view-model.ts#buildWeekplannerWeek), not a
 *     new limitation introduced here.
 */

import { WEEKPLANNER_DEFAULT_TIMEZONE, zonedDateKey, parseDayKey } from "@/lib/weekplanner/date";
import { resolveTrainingDayWindow, resolveTrainingWeekWindow } from "@/lib/training/date-range";
import { getWeekplannerDay } from "@/lib/weekplanner/queries";
import { getOperationalWeekplannerPlan } from "@/lib/weekplanner/plan-service";
import type {
  WeekplannerItem,
  WeekplannerMatchItem,
  WeekplannerResourceRef,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
} from "@/lib/weekplanner/types";
import type { PublicationEventLoader, PublicationEventLoadInput } from "../policy/event-selection";
import type { Screen1SourceEvent } from "./screen1-event-mapper";
import type { PublishingEventStatus } from "../event-types";
import { getPitchAllocationByCode } from "@/lib/facilities/pitches";

// ── Injected policy-metadata database ──────────────────────────────────────

/** Publication-policy / display metadata for a canonical MATCH or TOURNAMENT (Event-backed). */
export type CanonicalEventPolicyRow = {
  readonly id: string;
  readonly status: string;
  readonly infoboardVisible: boolean;
  readonly websiteVisible: boolean;
  readonly trainingsplanVisible: boolean;
  readonly homeAway: string | null;
  readonly organizerName: string | null;
  readonly competitionLabel: string | null;
  readonly meetingTime: Date | null;
  readonly resultLabel: string | null;
  readonly intermediateResultLabel: string | null;
  // INFOBOARD-C1: nullable after ADMIN-DELETE-SEASON-01-C1 (Event.seasonId uses
  // onDelete: SetNull — permanently deleting a Season sets Event.seasonId to null).
  readonly season: { readonly key: string } | null;
};

/** Publication-policy / display metadata for a canonical TRAINING (TrainingSession-backed). */
export type CanonicalTrainingSessionPolicyRow = {
  readonly id: string;
  readonly status: string;
  readonly teamSeason: { readonly season: { readonly key: string } };
};

/**
 * Injected database contract for the canonical Infoboard source loader.
 *
 * Only ever queried BY ID for ids Weekplanner has already resolved as
 * belonging to the requested day — never used to independently decide
 * "which activities happened today".
 */
export type CanonicalInfoboardPolicyDatabase = {
  readonly event: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<CanonicalEventPolicyRow>>;
  };
  readonly trainingSession: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<CanonicalTrainingSessionPolicyRow>>;
  };
};

// ── Select clauses (kept inside this module; never mutated) ───────────────

export const CANONICAL_EVENT_POLICY_SELECT = {
  id: true,
  status: true,
  infoboardVisible: true,
  websiteVisible: true,
  trainingsplanVisible: true,
  homeAway: true,
  organizerName: true,
  competitionLabel: true,
  meetingTime: true,
  resultLabel: true,
  intermediateResultLabel: true,
  season: { select: { key: true } },
} as const;

export const CANONICAL_TRAINING_SESSION_POLICY_SELECT = {
  id: true,
  status: true,
  teamSeason: { select: { season: { select: { key: true } } } },
} as const;

// ── Calendar-day enumeration (Europe/Zurich, pure date-only math) ─────────

/** Safety cap on the number of calendar days a single loader invocation resolves. */
const MAX_WINDOW_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Enumerates the "YYYY-MM-DD" Europe/Zurich calendar day keys covered by
 * [dateFrom, dateTo] (inclusive), using the same zonedDateKey()/parseDayKey()
 * helpers Weekplanner itself uses for Europe/Zurich day resolution — no
 * second timezone algorithm.
 *
 * When both bounds are absent (no current Infoboard call site does this —
 * dateFrom/dateTo are always supplied), falls back to today only.
 */
function enumerateDayKeys(dateFrom?: Date, dateTo?: Date): string[] {
  const from = dateFrom ?? dateTo ?? new Date();
  const to = dateTo ?? dateFrom ?? from;

  const fromParsed = parseDayKey(zonedDateKey(from, WEEKPLANNER_DEFAULT_TIMEZONE));
  const toParsed = parseDayKey(zonedDateKey(to, WEEKPLANNER_DEFAULT_TIMEZONE));
  if (!fromParsed || !toParsed) return [];

  const startMs = Date.UTC(fromParsed.year, fromParsed.month - 1, fromParsed.day);
  const endMs = Date.UTC(toParsed.year, toParsed.month - 1, toParsed.day);
  const minMs = Math.min(startMs, endMs);
  const maxMs = Math.max(startMs, endMs);

  const keys: string[] = [];
  for (let cursorMs = minMs; cursorMs <= maxMs && keys.length < MAX_WINDOW_DAYS; cursorMs += MS_PER_DAY) {
    const cursor = new Date(cursorMs);
    keys.push(
      `${cursor.getUTCFullYear().toString().padStart(4, "0")}-${pad2(cursor.getUTCMonth() + 1)}-${pad2(cursor.getUTCDate())}`,
    );
  }
  return keys;
}

// ── Canonical operational resolution (per day) ─────────────────────────────

/**
 * Resolves ONE calendar day's effective canonical activities, following the
 * exact canonical operational resolution algorithm:
 *   1. resolve the day's canonical week (resolveTrainingWeekWindow)
 *   2. getOperationalWeekplannerPlan(tenantId, weekId)
 *   3. null -> Standardplan / plan -> that plan's effective state
 *   4. getWeekplannerDay(tenantId, dayWindow, planId)
 */
async function resolveEffectiveDayItems(
  tenantId: string,
  dayKey: string,
): Promise<WeekplannerItem[]> {
  const dayWindow = resolveTrainingDayWindow({
    dayParam: dayKey,
    timeZone: WEEKPLANNER_DEFAULT_TIMEZONE,
  });
  const weekWindow = resolveTrainingWeekWindow({
    weekParam: dayKey,
    timeZone: WEEKPLANNER_DEFAULT_TIMEZONE,
  });

  const operationalPlan = await getOperationalWeekplannerPlan(tenantId, weekWindow.param);

  const day = await getWeekplannerDay(
    tenantId,
    {
      from: dayWindow.from,
      to: dayWindow.to,
      date: dayWindow.date,
      param: dayWindow.param,
      previousParam: dayWindow.previousParam,
      nextParam: dayWindow.nextParam,
    },
    operationalPlan?.id,
  );

  return day.items;
}

// ── Policy-metadata batch loading (by id, never a second resolution) ──────

async function loadEventPolicyByEventId(
  database: CanonicalInfoboardPolicyDatabase,
  tenantId: string,
  items: readonly WeekplannerItem[],
): Promise<ReadonlyMap<string, CanonicalEventPolicyRow>> {
  const eventIds = [
    ...new Set(
      items
        .filter((item): item is WeekplannerMatchItem | WeekplannerTournamentItem =>
          item.type === "MATCH" || item.type === "TOURNAMENT",
        )
        .map((item) => item.eventId),
    ),
  ];
  if (eventIds.length === 0) return new Map();

  const rows = await database.event.findMany({
    where: { tenantId, id: { in: eventIds } },
    select: CANONICAL_EVENT_POLICY_SELECT,
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadTrainingPolicyBySessionId(
  database: CanonicalInfoboardPolicyDatabase,
  tenantId: string,
  items: readonly WeekplannerItem[],
): Promise<ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>> {
  const sessionIds = [
    ...new Set(
      items
        .filter((item): item is WeekplannerTrainingItem => item.type === "TRAINING")
        .map((item) => item.trainingSessionId),
    ),
  ];
  if (sessionIds.length === 0) return new Map();

  const rows = await database.trainingSession.findMany({
    where: { tenantId, id: { in: sessionIds } },
    select: CANONICAL_TRAINING_SESSION_POLICY_SELECT,
  });
  return new Map(rows.map((row) => [row.id, row]));
}

// ── WeekplannerItem -> Screen1SourceEvent mapping ──────────────────────────

function toAllocationCandidate(
  ref: WeekplannerResourceRef | undefined,
): { label: string | null; code: string; name: string; facilityName: string } | null {
  if (!ref) return null;
  // Use the infoboardLabel from the FCA pitch registry when available.
  // This converts codes like "KUNSTRASEN_2_A" to "KR 2 – Feld A" for TV readability.
  const pitchEntry = getPitchAllocationByCode(ref.code);
  const label = pitchEntry?.infoboardLabel ?? null;
  return { label, code: ref.code, name: ref.name, facilityName: ref.facilityName };
}

/**
 * Maps a raw TrainingSession.status to the shared PublishingEventStatus
 * union. MOVED has no direct equivalent — the occurrence's effective time
 * already reflects the move (TrainingSession.overrideStartAt/overrideEndAt,
 * resolved upstream by listTrainingSessions()), so it is treated as an
 * ordinary scheduled activity for publication purposes.
 */
function mapTrainingSessionStatus(raw: string | undefined): PublishingEventStatus {
  switch (raw) {
    case "CANCELLED":
      return "CANCELLED";
    case "POSTPONED":
      return "POSTPONED";
    case "MOVED":
    case "SCHEDULED":
    default:
      return "SCHEDULED";
  }
}

function mapTrainingItem(
  item: WeekplannerTrainingItem,
  policy: CanonicalTrainingSessionPolicyRow | undefined,
): Screen1SourceEvent {
  return {
    tenantId: item.tenantId,
    type: "TRAINING",
    status: mapTrainingSessionStatus(policy?.status),
    // Canonical cutover: no legacy Event(type=TRAINING) row is required (or
    // read) to make a TrainingSession visible on Infoboard — see module doc
    // comment. websiteVisible/trainingsplanVisible are not evaluated by the
    // INFOBOARD_SCREEN_1/2 policy channels; true is a neutral, non-blocking
    // default.
    infoboardVisible: true,
    websiteVisible: true,
    trainingsplanVisible: true,
    homeAway: null,
    startAt: item.startAt,
    endAt: item.endAt,
    id: item.id,
    title: item.title,
    seasonKey: policy?.teamSeason.season.key ?? "",
    team: { name: item.teamNames[0] ?? null },
    opponent: null,
    opponentFallbackName: null,
    organizerName: null,
    competitionLabel: null,
    meetingTime: null,
    resultLabel: null,
    intermediateResultLabel: null,
    pitch: toAllocationCandidate(item.pitchAllocations[0]),
    // INFOBOARD-INTEGRATION-01C: Screen 2 needs every occupied resource, not
    // just the first — carried alongside the singular `pitch`/`homeDressingRoom`
    // candidates Screen 1 already reads unchanged.
    pitchCodes: item.pitchAllocations.map((ref) => ref.code),
    homeDressingRoom: toAllocationCandidate(item.dressingRoomAllocations[0]),
    homeDressingRoomCodes: item.dressingRoomAllocations.map((ref) => ref.code),
    awayDressingRoom: null,
    refereeDressingRoom: null,
  };
}

function mapMatchItem(
  item: WeekplannerMatchItem,
  policy: CanonicalEventPolicyRow | undefined,
): Screen1SourceEvent {
  return {
    tenantId: item.tenantId,
    type: "MATCH",
    // Fail closed when no policy row is found (should never happen — the
    // eventId was itself resolved from Event by Weekplanner): excluded via
    // STATUS_NOT_PUBLISHABLE / INFOBOARD_HIDDEN rather than defaulting to visible.
    status: (policy?.status as PublishingEventStatus | undefined) ?? "DRAFT",
    infoboardVisible: policy?.infoboardVisible ?? false,
    websiteVisible: policy?.websiteVisible ?? false,
    trainingsplanVisible: policy?.trainingsplanVisible ?? false,
    // The RAW Event.homeAway value — deliberately NOT item.homeAway (always
    // the literal "HOME", since Weekplanner's own HOME/AWAY filter is
    // permissive: "not AWAY" counts as home). Publication policy requires
    // the strict, explicit "HOME" value; reading the raw column here
    // preserves that existing HOME_AWAY_UNKNOWN behaviour unchanged.
    homeAway: policy?.homeAway ?? null,
    startAt: item.startAt,
    endAt: item.endAt,
    id: item.id,
    title: item.title,
    seasonKey: policy?.season?.key ?? "",
    team: { name: item.teamNames[0] ?? null },
    opponent: null,
    opponentFallbackName: item.opponentName,
    organizerName: policy?.organizerName ?? null,
    competitionLabel: policy?.competitionLabel ?? null,
    meetingTime: policy?.meetingTime ?? null,
    resultLabel: policy?.resultLabel ?? null,
    intermediateResultLabel: policy?.intermediateResultLabel ?? null,
    pitch: toAllocationCandidate(item.pitchAllocations[0]),
    pitchCodes: item.pitchAllocations.map((ref) => ref.code),
    homeDressingRoom: toAllocationCandidate(item.dressingRoomAllocations[0]),
    homeDressingRoomCodes: item.dressingRoomAllocations.map((ref) => ref.code),
    awayDressingRoom: toAllocationCandidate(item.awayDressingRoomAllocations[0]),
    awayDressingRoomCodes: item.awayDressingRoomAllocations.map((ref) => ref.code),
    refereeDressingRoom: null,
  };
}

function mapTournamentItem(
  item: WeekplannerTournamentItem,
  policy: CanonicalEventPolicyRow | undefined,
): Screen1SourceEvent {
  return {
    tenantId: item.tenantId,
    type: "TOURNAMENT",
    status: (policy?.status as PublishingEventStatus | undefined) ?? "DRAFT",
    infoboardVisible: policy?.infoboardVisible ?? false,
    websiteVisible: policy?.websiteVisible ?? false,
    trainingsplanVisible: policy?.trainingsplanVisible ?? false,
    homeAway: policy?.homeAway ?? null,
    startAt: item.startAt,
    endAt: item.endAt,
    id: item.id,
    title: item.title,
    seasonKey: policy?.season?.key ?? "",
    team: { name: item.teamNames[0] ?? null },
    opponent: null,
    opponentFallbackName: null,
    organizerName: policy?.organizerName ?? null,
    competitionLabel: policy?.competitionLabel ?? null,
    meetingTime: policy?.meetingTime ?? null,
    resultLabel: policy?.resultLabel ?? null,
    intermediateResultLabel: policy?.intermediateResultLabel ?? null,
    pitch: toAllocationCandidate(item.pitchAllocations[0]),
    pitchCodes: item.pitchAllocations.map((ref) => ref.code),
    // TOURNAMENTCENTER-01B participant Garderobe allocations have no
    // representation in the shared Screen1SourceEvent contract (single
    // home/away/referee slots) — same limitation the legacy Event-based
    // loader already had (no canonical TournamentParticipant model was
    // ever wired into Screen 1). Not a regression introduced here. Screen 2
    // therefore cannot show per-participant dressing-room allocations for
    // tournaments (known limitation — see final report).
    homeDressingRoom: null,
    awayDressingRoom: null,
    refereeDressingRoom: null,
  };
}

function mapWeekplannerItem(
  item: WeekplannerItem,
  policy: {
    eventPolicyByEventId: ReadonlyMap<string, CanonicalEventPolicyRow>;
    trainingPolicyBySessionId: ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>;
  },
): Screen1SourceEvent {
  switch (item.type) {
    case "TRAINING":
      return mapTrainingItem(item, policy.trainingPolicyBySessionId.get(item.trainingSessionId));
    case "MATCH":
      return mapMatchItem(item, policy.eventPolicyByEventId.get(item.eventId));
    case "TOURNAMENT":
      return mapTournamentItem(item, policy.eventPolicyByEventId.get(item.eventId));
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Creates a PublicationEventLoader<Screen1SourceEvent> backed by the
 * canonical Weekplanner / Day Planning effective-state pipeline instead of
 * legacy Event rows.
 *
 * `teamSlug` (PublicationEventLoadInput) is intentionally not supported —
 * see the module doc comment's "known, deliberate limitations". `seasonKey`
 * is applied as a post-resolution filter against each activity's resolved
 * season key.
 */
export function createCanonicalInfoboardSourceLoader(
  database: CanonicalInfoboardPolicyDatabase,
): PublicationEventLoader<Screen1SourceEvent> {
  return async function loadCanonicalInfoboardEvents(
    input: PublicationEventLoadInput,
  ): Promise<readonly Screen1SourceEvent[]> {
    const dayKeys = enumerateDayKeys(input.dateFrom, input.dateTo);

    const days = await Promise.all(
      dayKeys.map((dayKey) => resolveEffectiveDayItems(input.tenantId, dayKey)),
    );
    const items: WeekplannerItem[] = days.flat();

    if (items.length === 0) return [];

    const [eventPolicyByEventId, trainingPolicyBySessionId] = await Promise.all([
      loadEventPolicyByEventId(database, input.tenantId, items),
      loadTrainingPolicyBySessionId(database, input.tenantId, items),
    ]);

    const mapped = items.map((item) =>
      mapWeekplannerItem(item, { eventPolicyByEventId, trainingPolicyBySessionId }),
    );

    if (!input.seasonKey) return mapped;
    return mapped.filter((event) => event.seasonKey === input.seasonKey);
  };
}
