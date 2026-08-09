/**
 * lib/weekplanner/queries.ts
 *
 * WEEKPLANNER-01A — Canonical Weekplanner Foundation.
 *
 * Read-only aggregator over the three EXISTING canonical planning sources —
 * introduces no second planning database, no duplicated TrainingSession/
 * Event rows, and no parallel allocation model:
 *
 *   - TrainingSession, via the canonical lib/training/session-generation-
 *     service.ts::listTrainingSessions() (already tenant-scoped, already
 *     resolves TRAININGCENTER-02 occurrence-level reschedule overrides).
 *     Resource allocation is resolved the same way TrainingCenter's own
 *     availability aggregator does it (lib/facilities/availability-
 *     service.ts): a TrainingSessionAllocation override for a given
 *     allocation group (Spielfeld/Halle vs. Garderobe — see
 *     lib/training/allocation-groups.ts) wins when present, otherwise the
 *     parent TrainingSeries' TrainingAllocation default applies.
 *
 *   - Event(type=MATCH), via the canonical lib/matchcenter/query-
 *     service.ts::listMatchcenterMatches(). Only HOME matches are surfaced
 *     — an AWAY match is never FC Allschwil's facility occupancy (product
 *     requirement). Facility allocation is still the legacy Wochenplan V1
 *     Event.pitchCode / homeDressingRoomCode / awayDressingRoomCode string
 *     fields (NOT migrated in this slice, per the WEEKPLANNER-01A scope) —
 *     resolved to the canonical FacilityResource by code, exactly like
 *     lib/facilities/availability-service.ts#findMatchConflicts already
 *     does for guided creation.
 *
 *   - Event(type=TOURNAMENT), via the canonical lib/tournaments/tournament-
 *     service.ts::listTournaments(). Only HOME tournaments are surfaced.
 *     Facility allocation is the canonical TournamentResourceAllocation
 *     (Spielfeld/Halle) + per-participant TournamentParticipantAllocation
 *     (Garderobe) — already keyed by FacilityResource id, no code
 *     resolution needed.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from
 *     client-supplied input.
 *   - Every query below is scoped by tenantId; a cross-tenant TrainingSeries/
 *     TrainingSession/FacilityResource/Event can never leak into the result.
 */

import { prisma } from "@/lib/db/prisma";
import { listTrainingSessions } from "@/lib/training/session-generation-service";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import {
  listMatchcenterMatches,
  type MatchcenterQueryDatabase,
} from "@/lib/matchcenter/query-service";
import { listTournaments } from "@/lib/tournaments/tournament-service";
import { formatWeekNumberLabel, formatWeekRangeLabel } from "./date";
import { buildWeekplannerWeek } from "./view-model";
import type {
  WeekplannerItem,
  WeekplannerMatchItem,
  WeekplannerResourceRef,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
  WeekplannerWeek,
} from "./types";

export type WeekplannerWindow = {
  from: Date;
  to: Date;
  /** 7 "YYYY-MM-DD" day keys, Monday first (Europe/Zurich calendar dates). */
  days: readonly string[];
  param: string;
  previousParam: string;
  nextParam: string;
};

// ── FacilityResource code map (legacy MATCH pitchCode/dressingRoomCode resolution) ──

type FacilityResourceRow = {
  id: string;
  code: string;
  name: string;
  facility: { name: string };
};

function toResourceRef(row: FacilityResourceRow): WeekplannerResourceRef {
  return {
    facilityResourceId: row.id,
    code: row.code,
    name: row.name,
    facilityName: row.facility.name,
  };
}

async function findFacilityResourceCodeMap(
  tenantId: string,
): Promise<Map<string, WeekplannerResourceRef>> {
  const resources = await prisma.facilityResource.findMany({
    where: {
      tenantId,
      status: { not: "ARCHIVED" },
      facility: { status: { not: "ARCHIVED" } },
    },
    select: { id: true, code: true, name: true, facility: { select: { name: true } } },
  });

  return new Map(resources.map((resource) => [resource.code, toResourceRef(resource)]));
}

// ── TrainingSession → WeekplannerTrainingItem ───────────────────────────────

type AllocationResourceRow = {
  facilityResource: { id: string; code: string; name: string; type: string; facility: { name: string } };
};

/** Splits a flat allocation-row list into the two Weekplanner-relevant groups (Spielfeld/Halle, Garderobe). */
function groupAllocationRows(
  rows: readonly AllocationResourceRow[],
): { pitch: WeekplannerResourceRef[]; dressingRoom: WeekplannerResourceRef[] } {
  const pitch: WeekplannerResourceRef[] = [];
  const dressingRoom: WeekplannerResourceRef[] = [];

  for (const row of rows) {
    const ref: WeekplannerResourceRef = {
      facilityResourceId: row.facilityResource.id,
      code: row.facilityResource.code,
      name: row.facilityResource.name,
      facilityName: row.facilityResource.facility.name,
    };
    const group = classifyFacilityResourceType(row.facilityResource.type);
    if (group === "PITCH_HALL") pitch.push(ref);
    else if (group === "DRESSING_ROOM") dressingRoom.push(ref);
  }

  return { pitch, dressingRoom };
}

async function findWeekplannerTrainingItems(
  tenantId: string,
  days: readonly string[],
): Promise<WeekplannerTrainingItem[]> {
  if (days.length === 0) return [];

  // TrainingSession.date is a pure calendar-date key (UTC-midnight
  // convention — see the TrainingSession Prisma model doc comment), NOT a
  // real timezone-zoned instant. The correct, DST-safe way to bound it is
  // therefore to build UTC-midnight Dates directly from the already
  // Europe/Zurich-resolved day keys — never by truncating a genuine zoned
  // instant (which would silently shift the window by one calendar day).
  const dateFrom = new Date(`${days[0]}T00:00:00.000Z`);
  const dateTo = new Date(`${days[days.length - 1]}T00:00:00.000Z`);

  const sessions = await listTrainingSessions(tenantId, { dateFrom, dateTo });
  if (sessions.length === 0) return [];

  const seriesIds = [...new Set(sessions.map((session) => session.trainingSeriesId))];
  const sessionIds = sessions.map((session) => session.id);

  const [seriesAllocationRows, sessionOverrideRows] = await Promise.all([
    prisma.trainingAllocation.findMany({
      where: { tenantId, trainingSeriesId: { in: seriesIds } },
      select: {
        trainingSeriesId: true,
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
    }),
    prisma.trainingSessionAllocation.findMany({
      where: { tenantId, trainingSessionId: { in: sessionIds } },
      select: {
        trainingSessionId: true,
        facilityResource: {
          select: { id: true, code: true, name: true, type: true, facility: { select: { name: true } } },
        },
      },
    }),
  ]);

  const seriesAllocationsById = new Map<string, AllocationResourceRow[]>();
  for (const row of seriesAllocationRows) {
    const list = seriesAllocationsById.get(row.trainingSeriesId) ?? [];
    list.push(row);
    seriesAllocationsById.set(row.trainingSeriesId, list);
  }

  const sessionOverridesById = new Map<string, AllocationResourceRow[]>();
  for (const row of sessionOverrideRows) {
    const list = sessionOverridesById.get(row.trainingSessionId) ?? [];
    list.push(row);
    sessionOverridesById.set(row.trainingSessionId, list);
  }

  return sessions.map((session) => {
    const seriesGroups = groupAllocationRows(seriesAllocationsById.get(session.trainingSeriesId) ?? []);
    const overrideRows = sessionOverridesById.get(session.id) ?? [];
    const overrideGroups = groupAllocationRows(overrideRows);

    // TRAININGCENTER-02 override-by-presence-per-group: any override row
    // for a group supersedes that group's series-level default for this
    // occurrence only (see lib/training/session-allocation-service.ts).
    const pitchAllocations =
      overrideGroups.pitch.length > 0 ? overrideGroups.pitch : seriesGroups.pitch;
    const dressingRoomAllocations =
      overrideGroups.dressingRoom.length > 0 ? overrideGroups.dressingRoom : seriesGroups.dressingRoom;

    return {
      id: `training:${session.id}`,
      tenantId,
      type: "TRAINING",
      startAt: new Date(session.startAt),
      endAt: new Date(session.endAt),
      title: session.trainingSeriesTitle,
      teamNames: [session.teamName],
      pitchAllocations,
      dressingRoomAllocations,
      conflicts: [],
      trainingSeriesId: session.trainingSeriesId,
      trainingSessionId: session.id,
    } satisfies WeekplannerTrainingItem;
  });
}

// ── Event(type=MATCH) → WeekplannerMatchItem (HOME only) ────────────────────

function isAwayHomeAway(value: string | null): boolean {
  return value?.trim().toUpperCase() === "AWAY";
}

function isCancelled(status: string): boolean {
  const normalized = status.trim().toUpperCase();
  return normalized === "CANCELLED" || normalized === "CANCELED";
}

async function findWeekplannerHomeMatches(
  tenantId: string,
  from: Date,
  to: Date,
  resourceByCode: ReadonlyMap<string, WeekplannerResourceRef>,
): Promise<WeekplannerMatchItem[]> {
  const database = prisma as unknown as MatchcenterQueryDatabase;
  const matches = await listMatchcenterMatches(database, { tenantId, from, to });

  const homeMatches = matches.filter(
    (match) => !isAwayHomeAway(match.homeAway) && !isCancelled(match.status),
  );

  return homeMatches.map((match) => {
    const pitchRef = match.operational.pitchCode
      ? resourceByCode.get(match.operational.pitchCode)
      : undefined;
    const homeRoomRef = match.operational.homeDressingRoomCode
      ? resourceByCode.get(match.operational.homeDressingRoomCode)
      : undefined;
    const awayRoomRef = match.operational.awayDressingRoomCode
      ? resourceByCode.get(match.operational.awayDressingRoomCode)
      : undefined;

    return {
      id: `match:${match.id}`,
      tenantId: match.tenantId,
      type: "MATCH",
      startAt: new Date(match.startAt),
      endAt: match.endAt ? new Date(match.endAt) : new Date(match.startAt),
      title: match.title,
      teamNames: [match.home.displayName],
      opponentName: match.away.displayName,
      homeAway: "HOME",
      eventId: match.id,
      pitchAllocations: pitchRef ? [pitchRef] : [],
      dressingRoomAllocations: homeRoomRef ? [homeRoomRef] : [],
      awayDressingRoomAllocations: awayRoomRef ? [awayRoomRef] : [],
      conflicts: [],
    } satisfies WeekplannerMatchItem;
  });
}

// ── Event(type=TOURNAMENT) → WeekplannerTournamentItem (HOME only) ──────────

async function findWeekplannerHomeTournaments(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<WeekplannerTournamentItem[]> {
  const tournaments = await listTournaments(tenantId);

  const homeTournaments = tournaments.filter((tournament) => {
    if (tournament.homeAway !== "HOME") return false;
    if (isCancelled(tournament.status)) return false;

    const startAt = new Date(tournament.startAt).getTime();
    const endAt = tournament.endAt ? new Date(tournament.endAt).getTime() : startAt;
    return startAt < to.getTime() && endAt >= from.getTime();
  });

  return homeTournaments.map((tournament) => {
    const startAt = new Date(tournament.startAt);
    const endAt = tournament.endAt ? new Date(tournament.endAt) : startAt;

    const ownTeamNames = tournament.participants
      .filter((participant) => participant.kind === "TEAM")
      .map((participant) => participant.displayName);

    return {
      id: `tournament:${tournament.id}`,
      tenantId: tournament.tenantId,
      type: "TOURNAMENT",
      startAt,
      endAt,
      title: tournament.title,
      teamNames: ownTeamNames,
      homeAway: "HOME",
      eventId: tournament.id,
      pitchAllocations: tournament.resourceAllocations.map((allocation) => ({
        facilityResourceId: allocation.facilityResourceId,
        code: allocation.facilityResourceCode,
        name: allocation.facilityResourceName,
        facilityName: allocation.facilityName,
      })),
      dressingRoomAllocations: [],
      participantAllocations: tournament.participants.map((participant) => ({
        participantLabel: participant.displayName,
        dressingRoomAllocations: participant.dressingRoomAllocations.map((allocation) => ({
          facilityResourceId: allocation.facilityResourceId,
          code: allocation.facilityResourceCode,
          name: allocation.facilityResourceName,
          facilityName: allocation.facilityName,
        })),
      })),
      conflicts: [],
    } satisfies WeekplannerTournamentItem;
  });
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Assembles the full canonical Weekplanner week: TrainingSessions +
 * HOME matches + HOME tournaments, tenant-scoped, day-bucketed,
 * chronologically ordered, and annotated with resource-conflict
 * ("⚠ Doppelbelegung") indicators.
 */
export async function getWeekplannerWeek(
  tenantId: string,
  window: WeekplannerWindow,
): Promise<WeekplannerWeek> {
  const resourceByCode = await findFacilityResourceCodeMap(tenantId);

  const [trainingItems, matchItems, tournamentItems] = await Promise.all([
    findWeekplannerTrainingItems(tenantId, window.days),
    findWeekplannerHomeMatches(tenantId, window.from, window.to, resourceByCode),
    findWeekplannerHomeTournaments(tenantId, window.from, window.to),
  ]);

  const items: WeekplannerItem[] = [...trainingItems, ...matchItems, ...tournamentItems];

  return buildWeekplannerWeek({
    items,
    days: window.days,
    weekNumberLabel: formatWeekNumberLabel(window.days),
    rangeLabel: formatWeekRangeLabel(window.days),
    param: window.param,
    previousParam: window.previousParam,
    nextParam: window.nextParam,
  });
}
