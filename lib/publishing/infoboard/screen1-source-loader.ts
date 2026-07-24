/**
 * lib/publishing/infoboard/screen1-source-loader.ts
 *
 * Concrete, tenant-scoped source loader for Infoboard Screen 1.
 *
 * Creates a PublicationEventLoader<Screen1SourceEvent> backed by an injected
 * database interface. The loader:
 *   - filters by tenantId (always required);
 *   - forwards dateFrom / dateTo / seasonKey / teamSlug when supplied;
 *   - orders deterministically;
 *   - resolves TeamSeason display names for the event's own season;
 *   - preserves raw Event.opponentName as opponentFallbackName
 *     (no canonical Opponent join — Event has no opponentId field);
 *   - resolves pitch and dressing-room codes via a single batch DB query
 *     followed by a static registry lookup, both scoped to the tenant;
 *   - does NOT evaluate publication eligibility (delegated to PP-01B);
 *   - does NOT apply temporal grouping (delegated to the feed builder).
 *
 * Tournament participants: no canonical TournamentParticipant/EventParticipant
 * model exists in the current schema. No fabricated participant data is
 * produced. Standard two-team / training event rendering is fully supported.
 * When the canonical model is introduced, add a separate query and populate
 * InfoboardEventPresentationExtension entries in the live service.
 *
 * Design constraints:
 *   - No Prisma import. Database access is injected via Screen1SourceDatabase.
 *   - No Next.js, no React.
 *   - No environment variable access, no logging, no time access.
 *   - No publication eligibility recalculation.
 *   - No temporal grouping.
 *   - Inputs are never mutated.
 *   - Result arrays are always new arrays.
 */

import { getPitchAllocationByCode } from "@/lib/facilities/pitches";
import { getDressingRoomByCode } from "@/lib/facilities/dressing-rooms";
import type { PublicationEventLoader } from "../policy/event-selection";
import type { Screen1SourceEvent } from "./screen1-event-mapper";
import type { PublishingEventType, PublishingEventStatus } from "../event-types";

// ── DB row shapes ─────────────────────────────────────────────────────────────

/**
 * TeamSeason row as returned by the DB query.
 * Only the fields required for Screen1SourceEvent.team are selected.
 */
export type Screen1TeamSeasonRow = {
  readonly seasonId: string;
  readonly displayName: string;
  readonly shortName: string | null;
};

/**
 * Team row as returned by the DB query.
 * Includes all teamSeasons so the loader can filter by event.seasonId in JS.
 */
export type Screen1TeamRow = {
  readonly name: string;
  readonly teamSeasons: readonly Screen1TeamSeasonRow[];
};

/**
 * Event row as returned by the DB query.
 * All fields required to populate a Screen1SourceEvent are included.
 * `type` and `status` are string (not Prisma enum) so the loader
 * remains free of @prisma/client runtime imports.
 */
export type Screen1DbEventRow = {
  readonly id: string;
  readonly tenantId: string | null;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly seasonId: string;
  readonly infoboardVisible: boolean;
  readonly websiteVisible: boolean;
  readonly trainingsplanVisible: boolean;
  readonly homeAway: string | null;
  readonly opponentName: string | null;
  readonly organizerName: string | null;
  readonly competitionLabel: string | null;
  readonly meetingTime: Date | null;
  readonly resultLabel: string | null;
  readonly intermediateResultLabel: string | null;
  readonly pitchCode: string | null;
  readonly homeDressingRoomCode: string | null;
  readonly awayDressingRoomCode: string | null;
  readonly season: { readonly key: string };
  readonly team: Screen1TeamRow | null;
};

/**
 * FacilityResource row as returned by the DB query.
 * Only code and name are needed for display resolution.
 */
export type Screen1FacilityResourceRow = {
  readonly code: string;
  readonly name: string;
};

// ── Database interface ────────────────────────────────────────────────────────

/**
 * Injected database contract for the Screen 1 source loader.
 *
 * Callers at the route/composition boundary implement this interface using
 * the Prisma client. Tests supply lightweight mocks.
 *
 * The `event.findMany` method must:
 *   - accept a `where` object with at least `{ tenantId }`;
 *   - accept an `orderBy` array;
 *   - accept a `select` object;
 *   - return rows that structurally satisfy Screen1DbEventRow.
 *
 * `facilityResource` is optional; when absent, only the static registry
 * is used for code resolution.
 */
export type Screen1SourceDatabase = {
  readonly event: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly orderBy: ReadonlyArray<Record<string, unknown>>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen1DbEventRow>>;
  };
  readonly facilityResource?: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen1FacilityResourceRow>>;
  };
};

// ── Select clause (kept inside the factory; never mutated) ────────────────────

const EVENT_SELECT = {
  id: true,
  tenantId: true,
  type: true,
  status: true,
  title: true,
  startAt: true,
  endAt: true,
  seasonId: true,
  infoboardVisible: true,
  websiteVisible: true,
  trainingsplanVisible: true,
  homeAway: true,
  opponentName: true,
  organizerName: true,
  competitionLabel: true,
  meetingTime: true,
  resultLabel: true,
  intermediateResultLabel: true,
  pitchCode: true,
  homeDressingRoomCode: true,
  awayDressingRoomCode: true,
  season: {
    select: {
      key: true,
    },
  },
  team: {
    select: {
      name: true,
      teamSeasons: {
        select: {
          seasonId: true,
          displayName: true,
          shortName: true,
        },
      },
    },
  },
} as const;

// ── Deterministic order matching existing public-event-feed.ts convention ──────

const EVENT_ORDER_BY = [
  { startAt: "asc" },
  { sortOrder: "asc" },
  { title: "asc" },
] as const;

// ── Facility resource batch lookup ────────────────────────────────────────────

async function batchLoadFacilityResourceNames(
  database: Screen1SourceDatabase,
  tenantId: string,
  codes: ReadonlySet<string>,
): Promise<ReadonlyMap<string, string>> {
  if (codes.size === 0 || !database.facilityResource) {
    return new Map();
  }

  const rows = await database.facilityResource.findMany({
    where: { tenantId, code: { in: Array.from(codes) } },
    select: { code: true, name: true },
  });

  return new Map(rows.map((r) => [r.code, r.name]));
}

// ── Row → Screen1SourceEvent mapping ─────────────────────────────────────────

function mapRowToSourceEvent(
  row: Screen1DbEventRow,
  resourceNameMap: ReadonlyMap<string, string>,
): Screen1SourceEvent {
  // ── Team + TeamSeason resolution ─────────────────────────────────────────
  // Filter teamSeasons by event.seasonId to get the season-scoped display name.
  // If no matching TeamSeason exists, team.name is the fallback.
  const matchingTeamSeason =
    row.team?.teamSeasons.find((ts) => ts.seasonId === row.seasonId) ?? null;

  const team = row.team
    ? {
        name: row.team.name,
        displayName: matchingTeamSeason?.displayName ?? null,
        shortName: matchingTeamSeason?.shortName ?? null,
      }
    : null;

  // ── Pitch resolution ──────────────────────────────────────────────────────
  // Priority in Screen1SourceEvent.pitch (processed by resolvePitchDisplay):
  //   label (static registry) > code (raw) > name (DB FacilityResource.name)
  const pitchStaticLabel = row.pitchCode
    ? (getPitchAllocationByCode(row.pitchCode)?.websiteLabel ?? null)
    : null;
  const pitchDbName = row.pitchCode
    ? (resourceNameMap.get(row.pitchCode) ?? null)
    : null;
  const pitch = row.pitchCode
    ? {
        label: pitchStaticLabel,
        code: row.pitchCode,
        name: pitchDbName,
        facilityName: null,
      }
    : null;

  // ── Home dressing-room resolution ─────────────────────────────────────────
  const homeRoomStaticLabel = row.homeDressingRoomCode
    ? (getDressingRoomByCode(row.homeDressingRoomCode)?.label ?? null)
    : null;
  const homeRoomDbName = row.homeDressingRoomCode
    ? (resourceNameMap.get(row.homeDressingRoomCode) ?? null)
    : null;
  const homeDressingRoom = row.homeDressingRoomCode
    ? {
        label: homeRoomStaticLabel,
        code: row.homeDressingRoomCode,
        name: homeRoomDbName,
      }
    : null;

  // ── Away dressing-room resolution ─────────────────────────────────────────
  const awayRoomStaticLabel = row.awayDressingRoomCode
    ? (getDressingRoomByCode(row.awayDressingRoomCode)?.label ?? null)
    : null;
  const awayRoomDbName = row.awayDressingRoomCode
    ? (resourceNameMap.get(row.awayDressingRoomCode) ?? null)
    : null;
  const awayDressingRoom = row.awayDressingRoomCode
    ? {
        label: awayRoomStaticLabel,
        code: row.awayDressingRoomCode,
        name: awayRoomDbName,
      }
    : null;

  return {
    // ── PublicationPolicyEvent fields ──────────────────────────────────────
    tenantId: row.tenantId,
    type: row.type as PublishingEventType,
    status: row.status as PublishingEventStatus,
    infoboardVisible: row.infoboardVisible,
    websiteVisible: row.websiteVisible,
    trainingsplanVisible: row.trainingsplanVisible,
    homeAway: row.homeAway,
    // ── TemporalEvent fields ───────────────────────────────────────────────
    startAt: row.startAt,
    endAt: row.endAt,
    // ── Identity ──────────────────────────────────────────────────────────
    id: row.id,
    // ── Display ───────────────────────────────────────────────────────────
    title: row.title,
    seasonKey: row.season.key,
    // ── Team naming ───────────────────────────────────────────────────────
    team,
    // ── Opponent naming ───────────────────────────────────────────────────
    // No direct opponentId on Event; canonical Opponent lookup not available
    // without a multi-step join through MatchExternalMapping.
    // The raw opponentName is preserved as the fallback.
    opponent: null,
    opponentFallbackName: row.opponentName,
    // ── Organizer ─────────────────────────────────────────────────────────
    organizerName: row.organizerName,
    // ── Competition ───────────────────────────────────────────────────────
    competitionLabel: row.competitionLabel,
    // ── Timing ────────────────────────────────────────────────────────────
    meetingTime: row.meetingTime,
    resultLabel: row.resultLabel,
    intermediateResultLabel: row.intermediateResultLabel,
    // ── Facility allocations ───────────────────────────────────────────────
    pitch,
    homeDressingRoom,
    awayDressingRoom,
    // refereeDressingRoom: not stored on Event (no refereeDressingRoomCode field)
    refereeDressingRoom: null,
  };
}

// ── createScreen1SourceLoader ─────────────────────────────────────────────────

/**
 * Creates a tenant-scoped PublicationEventLoader<Screen1SourceEvent>.
 *
 * The loader:
 *   1. Builds a tenant-scoped where clause from the load input.
 *   2. Queries event rows + team/teamSeason relations in one DB call.
 *   3. Collects all pitch and dressing-room codes used in those rows.
 *   4. Batch-resolves DB FacilityResource names in one additional DB call.
 *   5. Maps each event row to Screen1SourceEvent using static registry +
 *      DB name candidates for facility resolution.
 *
 * Publication eligibility is not evaluated here. Eligibility is delegated
 * to selectEventsForPublication() (PP-01B) which calls this loader exactly
 * once and then applies the publication policy.
 *
 * @param database - Injected DB interface. Use the Prisma client at the
 *   route/composition boundary; supply mocks in tests.
 */
export function createScreen1SourceLoader(
  database: Screen1SourceDatabase,
): PublicationEventLoader<Screen1SourceEvent> {
  return async function loadScreen1Events(input) {
    // ── Build where clause ─────────────────────────────────────────────────
    const where: Record<string, unknown> = {
      tenantId: input.tenantId,
    };

    if (input.dateFrom || input.dateTo) {
      const startAt: Record<string, unknown> = {};
      if (input.dateFrom) startAt.gte = input.dateFrom;
      if (input.dateTo) startAt.lte = input.dateTo;
      where.startAt = startAt;
    }

    if (input.seasonKey) {
      where.season = { key: input.seasonKey };
    }

    if (input.teamSlug) {
      where.team = { slug: input.teamSlug };
    }

    // ── Query events ──────────────────────────────────────────────────────
    const rows = await database.event.findMany({
      where,
      orderBy: EVENT_ORDER_BY,
      select: EVENT_SELECT,
    });

    if (rows.length === 0) {
      return [];
    }

    // ── Collect allocation codes for batch resource lookup ────────────────
    const allCodes = new Set<string>();
    for (const row of rows) {
      if (row.pitchCode) allCodes.add(row.pitchCode);
      if (row.homeDressingRoomCode) allCodes.add(row.homeDressingRoomCode);
      if (row.awayDressingRoomCode) allCodes.add(row.awayDressingRoomCode);
    }

    // ── Batch load FacilityResource names (single DB round-trip) ─────────
    const resourceNameMap = await batchLoadFacilityResourceNames(
      database,
      input.tenantId,
      allCodes,
    );

    // ── Map rows to Screen1SourceEvent ───────────────────────────────────
    return rows.map((row) => mapRowToSourceEvent(row, resourceNameMap));
  };
}
