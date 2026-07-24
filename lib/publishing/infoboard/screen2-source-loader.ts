/**
 * lib/publishing/infoboard/screen2-source-loader.ts
 *
 * Concrete, tenant-scoped source loader for Infoboard Screen 2.
 *
 * Creates a PublicationEventLoader<Screen2SourceEvent> backed by an injected
 * database interface. The loader also provides a separate facility-resource
 * loader used by the feed builder to determine which fields appear on the map.
 *
 * Design constraints:
 *   - No Prisma imports. Database access is injected via Screen2SourceDatabase.
 *   - No Next.js, no React.
 *   - No environment variable access, no logging, no time access.
 *   - No publication eligibility recalculation.
 *   - No temporal grouping.
 *   - Inputs are never mutated.
 *   - Result arrays are always new arrays.
 *
 * Resource loading:
 *   The loader returns ALL FacilityResources for the tenant (including dressing
 *   rooms). The resource normalizer in screen2-resource-normalizer.ts filters
 *   out dressing rooms and archived/inactive resources. This separation ensures
 *   the loader remains a thin DB-access layer with no filtering logic.
 *
 * Event ordering:
 *   Deterministic: startAt asc → sortOrder asc → title asc → id asc.
 *   Consistent with Screen 1 ordering conventions.
 *
 * Team/season resolution:
 *   Identical to Screen 1: TeamSeason.displayName is matched by seasonId,
 *   falling back to Team.name.
 *
 * Dressing-room code resolution:
 *   Raw codes (homeDressingRoomCode, awayDressingRoomCode) are preserved.
 *   The event mapper resolves them to display labels using the resource name map.
 */

import type { PublicationEventLoader } from "../policy/event-selection";
import type { Screen2SourceEvent } from "./screen2-types";
import type { Screen2FacilityResourceRow } from "./screen2-resource-normalizer";
import type { PublishingEventType, PublishingEventStatus } from "../event-types";

// ── DB row shapes ─────────────────────────────────────────────────────────────

/** TeamSeason row as returned by the DB query. */
export type Screen2TeamSeasonRow = {
  readonly seasonId: string;
  readonly displayName: string;
  readonly shortName: string | null;
};

/** Team row as returned by the DB query. */
export type Screen2TeamRow = {
  readonly name: string;
  readonly teamSeasons: readonly Screen2TeamSeasonRow[];
};

/**
 * Event row as returned by the DB query.
 * All fields required to populate a Screen2SourceEvent are included.
 * `type` and `status` are plain strings (not Prisma enums) so the loader
 * remains free of @prisma/client runtime imports.
 */
export type Screen2DbEventRow = {
  readonly id: string;
  readonly tenantId: string | null;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly startAt: Date;
  readonly endAt: Date | null;
  readonly seasonId: string;
  readonly sortOrder: number;
  readonly infoboardVisible: boolean;
  readonly websiteVisible: boolean;
  readonly trainingsplanVisible: boolean;
  readonly homeAway: string | null;
  readonly opponentName: string | null;
  readonly organizerName: string | null;
  readonly competitionLabel: string | null;
  readonly pitchCode: string | null;
  readonly homeDressingRoomCode: string | null;
  readonly awayDressingRoomCode: string | null;
  readonly season: { readonly key: string };
  readonly team: Screen2TeamRow | null;
};

// ── Database interface ────────────────────────────────────────────────────────

/**
 * Injected database contract for the Screen 2 source loader.
 *
 * Callers at the route/composition boundary implement this interface using
 * the Prisma client. Tests supply lightweight mocks.
 *
 * `facilityResource.findMany` must return rows that structurally satisfy
 * Screen2FacilityResourceRow, including the nested `facility` relation.
 */
export type Screen2SourceDatabase = {
  readonly event: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly orderBy: ReadonlyArray<Record<string, unknown>>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen2DbEventRow>>;
  };
  readonly facilityResource: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly orderBy: ReadonlyArray<Record<string, unknown>>;
      readonly select: Record<string, unknown>;
    }) => Promise<ReadonlyArray<Screen2FacilityResourceRow>>;
  };
};

// ── Select clauses ─────────────────────────────────────────────────────────────

const EVENT_SELECT = {
  id: true,
  tenantId: true,
  type: true,
  status: true,
  title: true,
  startAt: true,
  endAt: true,
  seasonId: true,
  sortOrder: true,
  infoboardVisible: true,
  websiteVisible: true,
  trainingsplanVisible: true,
  homeAway: true,
  opponentName: true,
  organizerName: true,
  competitionLabel: true,
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

const FACILITY_RESOURCE_SELECT = {
  id: true,
  tenantId: true,
  facilityId: true,
  name: true,
  code: true,
  type: true,
  status: true,
  sortOrder: true,
  facility: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const FACILITY_RESOURCE_ORDER_BY = [
  { sortOrder: "asc" },
  { name: "asc" },
  { id: "asc" },
] as const;

const EVENT_ORDER_BY = [
  { startAt: "asc" },
  { sortOrder: "asc" },
  { title: "asc" },
  { id: "asc" },
] as const;

// ── Row → Screen2SourceEvent mapping ─────────────────────────────────────────

function mapRowToSourceEvent(row: Screen2DbEventRow): Screen2SourceEvent {
  // TeamSeason resolution: filter by event.seasonId, fall back to Team.name.
  const matchingTeamSeason =
    row.team?.teamSeasons.find((ts) => ts.seasonId === row.seasonId) ?? null;

  const team = row.team
    ? {
        name: row.team.name,
        displayName: matchingTeamSeason?.displayName ?? null,
        shortName: matchingTeamSeason?.shortName ?? null,
      }
    : null;

  return {
    tenantId: row.tenantId,
    type: row.type as PublishingEventType,
    status: row.status as PublishingEventStatus,
    infoboardVisible: row.infoboardVisible,
    websiteVisible: row.websiteVisible,
    trainingsplanVisible: row.trainingsplanVisible,
    homeAway: row.homeAway,
    startAt: row.startAt,
    endAt: row.endAt,
    id: row.id,
    sortOrder: row.sortOrder,
    title: row.title,
    team,
    teamFallbackName: null,
    opponentFallbackName: row.opponentName,
    competitionLabel: row.competitionLabel,
    organizerName: row.organizerName,
    pitchCode: row.pitchCode,
    homeDressingRoomCode: row.homeDressingRoomCode,
    awayDressingRoomCode: row.awayDressingRoomCode,
  };
}

// ── createScreen2SourceLoader ─────────────────────────────────────────────────

/**
 * Creates a tenant-scoped PublicationEventLoader<Screen2SourceEvent>.
 *
 * The loader:
 *   1. Builds a tenant-scoped where clause from the load input.
 *   2. Queries event rows + team/teamSeason relations in one DB call.
 *   3. Maps each event row to Screen2SourceEvent.
 *
 * Publication eligibility is not evaluated here — delegated to
 * selectEventsForPublication() (PP-01B) which calls this loader exactly once.
 *
 * @param database — Injected DB interface.
 */
export function createScreen2SourceLoader(
  database: Screen2SourceDatabase,
): PublicationEventLoader<Screen2SourceEvent> {
  return async function loadScreen2Events(input) {
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

    const rows = await database.event.findMany({
      where,
      orderBy: EVENT_ORDER_BY,
      select: EVENT_SELECT,
    });

    return rows.map(mapRowToSourceEvent);
  };
}

// ── createScreen2FacilityResourceLoader ───────────────────────────────────────

/**
 * Creates a loader that fetches all FacilityResources for a tenant.
 *
 * Returns ALL resource types (including DRESSING_ROOM). The resource normalizer
 * filters out dressing rooms and archived/inactive resources.
 *
 * The returned array includes the nested `facility` relation (id + name).
 *
 * @param database — Injected DB interface.
 * @param tenantId — Tenant to scope the query to.
 */
export function createScreen2FacilityResourceLoader(
  database: Screen2SourceDatabase,
  tenantId: string,
): () => Promise<ReadonlyArray<Screen2FacilityResourceRow>> {
  return async function loadFacilityResources() {
    return database.facilityResource.findMany({
      where: { tenantId },
      orderBy: FACILITY_RESOURCE_ORDER_BY,
      select: FACILITY_RESOURCE_SELECT,
    });
  };
}
