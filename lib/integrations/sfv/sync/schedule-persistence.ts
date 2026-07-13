/**
 * lib/integrations/sfv/sync/schedule-persistence.ts
 *
 * Database persistence layer for the SFV schedule synchronization.
 *
 * Responsibilities:
 *   - Load existing MatchExternalMapping rows and TeamExternalMapping rows.
 *   - Create new Event + MatchExternalMapping atomically on first import.
 *   - Update existing Event + MatchExternalMapping when provider data changes.
 *   - Resolve the canonical Season for an event from tenant+seasonId context.
 *
 * Architecture invariants:
 *   - All queries are scoped to a single tenantId — no cross-tenant leakage.
 *   - Event.teamId is set from the resolved local Team, not from SFV teamId.
 *   - Local-only Event fields (pitchCode, dressingRooms, visibility, etc.) are
 *     NEVER overwritten on update — only SFV-owned fields are updated.
 *   - Idempotent: running the same sync twice produces the same result.
 *   - Transactions used when creating both an Event and a mapping atomically.
 *   - No deletion: records are retained even when cancelled/postponed.
 *   - Opponent teams are NEVER created as tenant-owned Teams.
 *
 * Security invariants:
 *   - tenantId always originates from a trusted session context.
 *   - No raw provider payloads are written to logs or error messages.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ClubScheduleEntry } from "../client";
import type { SfvScheduleSyncContext } from "./schedule-types";
import {
  buildNewEventFields,
  buildMappingFields,
  detectChanges,
  mapMatchStateToEventStatus,
  buildResultLabel,
  resolveOpponentName,
  isLocalTeamId,
} from "./schedule-mapper";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of processing a single ClubScheduleEntry against the database.
 */
export type SchedulePersistenceOutcome =
  | { status: "created" }
  | {
      status: "updated";
      scoreChanged: boolean;
      kickoffChanged: boolean;
      statusChanged: boolean;
    }
  | { status: "unchanged" }
  | { status: "failed"; code: string; message: string };

// ── Existing mapping shape ─────────────────────────────────────────────────────

export type ExistingMatchMappingRow = {
  id: string;
  eventId: string;
  providerMatchState: number | null;
  providerMatchStateName: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerDivisionId: number | null;
  providerDivisionName: string | null;
  providerRoundNbr: number | null;
  providerVenueName: string | null;
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  event: {
    startAt: Date;
    status: string;
  };
};

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Loads all existing MatchExternalMapping rows for this tenant/provider/season.
 *
 * Returns a Map keyed by externalMatchId for O(1) lookup during the sync loop.
 * Includes the associated Event's startAt and status for change detection.
 * All rows are scoped to a single tenantId — no cross-tenant data is loaded.
 */
export async function loadExistingMatchMappings(
  tenantId: string,
  provider: string,
  seasonId: number,
): Promise<Map<number, ExistingMatchMappingRow>> {
  const rows = await prisma.matchExternalMapping.findMany({
    where: { tenantId, provider, externalSeasonId: seasonId },
    select: {
      id: true,
      externalMatchId: true,
      eventId: true,
      providerMatchState: true,
      providerMatchStateName: true,
      scoreHome: true,
      scoreAway: true,
      providerLeagueId: true,
      providerLeagueName: true,
      providerDivisionId: true,
      providerDivisionName: true,
      providerRoundNbr: true,
      providerVenueName: true,
      providerHomeTeamName: true,
      providerAwayTeamName: true,
      homeTeamId: true,
      awayTeamId: true,
      event: {
        select: { startAt: true, status: true },
      },
    },
  });

  const map = new Map<number, ExistingMatchMappingRow>();
  for (const row of rows) {
    map.set(row.externalMatchId, row);
  }
  return map;
}

/**
 * Loads all TeamExternalMapping rows for this tenant/provider/season.
 *
 * Returns a Map keyed by externalTeamId → canonical teamId (string).
 * Used to resolve local Team FKs from SFV team identifiers.
 */
export async function loadTeamMappings(
  tenantId: string,
  provider: string,
  seasonId: number,
): Promise<Map<number, string>> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      provider,
      externalSeasonId: seasonId,
      providerIsActive: true,
    },
    select: {
      externalTeamId: true,
      teamId: true,
    },
  });

  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(row.externalTeamId, row.teamId);
  }
  return map;
}

/**
 * Resolves the canonical Season id for the given tenantId using the active
 * season. Falls back to any season that is active.
 *
 * Returns null when no active season is found — the caller will use null
 * as seasonId on the Event (still stored, just not linked to a Season).
 */
export async function resolveActiveSeason(_tenantId: string): Promise<string | null> {
  // Season is currently a global (non-tenant-scoped) entity.
  // The _tenantId parameter is reserved for future per-tenant season scoping.
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { startDate: "desc" },
  });

  if (activeSeason) return activeSeason.id;

  // Fallback: most recent season
  const latestSeason = await prisma.season.findFirst({
    select: { id: true },
    orderBy: { startDate: "desc" },
  });

  return latestSeason?.id ?? null;
}

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new Event (type=MATCH) and its MatchExternalMapping atomically.
 *
 * Only called when no prior mapping exists for this externalMatchId.
 * Event fields set from provider data:
 *   - SFV-owned: startAt, status, opponentName, competitionLabel, location,
 *     resultLabel, homeAway, externalSource, externalSourceId, lastSyncedAt
 *   - Set to safe defaults (never overwritten): websiteVisible, etc.
 *
 * Opponent teams are NEVER created as tenant-owned Teams.
 */
export async function createMatchWithMapping(
  entry: ClubScheduleEntry,
  context: SfvScheduleSyncContext,
  seasonId: string | null,
  localTeamId: string | null,
  opponentName: string | null,
  isHome: boolean,
  homeTeamId: string | null,
  awayTeamId: string | null,
): Promise<SchedulePersistenceOutcome> {
  const eventFields = buildNewEventFields(entry, context, localTeamId, opponentName, isHome);
  const mappingFields = buildMappingFields(entry, context, homeTeamId, awayTeamId);

  if (seasonId === null) {
    return {
      status: "failed",
      code: "NO_ACTIVE_SEASON",
      message: `Cannot create Event for matchId ${entry.matchId}: no active season found.`,
    };
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const event = await tx.event.create({
        data: {
          seasonId,
          teamId: eventFields.teamId,
          type: eventFields.type,
          source: eventFields.source,
          status: eventFields.status,
          tenantId: eventFields.tenantId,
          title: eventFields.title,
          startAt: eventFields.startAt,
          opponentName: eventFields.opponentName,
          competitionLabel: eventFields.competitionLabel,
          location: eventFields.location,
          homeAway: eventFields.homeAway,
          resultLabel: eventFields.resultLabel,
          externalSource: eventFields.externalSource,
          externalSourceId: eventFields.externalSourceId,
          lastSyncedAt: eventFields.lastSyncedAt,
          // Safe defaults for locally managed fields
          websiteVisible: false,
          infoboardVisible: false,
          wochenplanVisible: false,
          homepageVisible: false,
          trainingsplanVisible: false,
          teamPageVisible: false,
        },
        select: { id: true },
      });

      await tx.matchExternalMapping.create({
        data: {
          tenantId: context.tenantId,
          eventId: event.id,
          ...mappingFields,
        },
      });
    });

    return { status: "created" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating match.";
    return {
      status: "failed",
      code: "MATCH_CREATE_FAILED",
      message: `Failed to create match for SFV matchId ${entry.matchId}: ${message}`,
    };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

/**
 * Updates an existing Event and MatchExternalMapping with the latest provider data.
 *
 * Only SFV-owned fields are updated on Event:
 *   - startAt (kickoff — may change after rescheduling)
 *   - status (derived from matchState)
 *   - opponentName (display name may change)
 *   - competitionLabel (league name may change)
 *   - location (venue may change)
 *   - resultLabel (score result string)
 *   - lastSyncedAt
 *
 * NEVER modifies locally managed Event fields:
 *   pitchCode, homeDressingRoomCode, awayDressingRoomCode,
 *   websiteVisible, infoboardVisible, wochenplanVisible, homepageVisible,
 *   trainingsplanVisible, teamPageVisible, sortOrder, remarks, description,
 *   reviewStage, reviewNotes, and any planning-related fields.
 *
 * MatchExternalMapping fields are fully updated on every changed sync.
 */
export async function updateMatchRecord(
  mappingId: string,
  eventId: string,
  entry: ClubScheduleEntry,
  context: SfvScheduleSyncContext,
  opponentName: string | null,
  homeTeamId: string | null,
  awayTeamId: string | null,
): Promise<SchedulePersistenceOutcome & { status: "updated" | "failed" }> {
  const mappingFields = buildMappingFields(entry, context, homeTeamId, awayTeamId);
  const kickoff = new Date(entry.matchDate);
  const status = mapMatchStateToEventStatus(entry.matchState, entry.matchStateName);
  const resultLabel = buildResultLabel(entry.scoreTeamA, entry.scoreTeamB, status);
  const competition = entry.leagueName ?? entry.divisionName ?? null;
  const venue = entry.stadiumPlaygroundName ?? null;

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update SFV-owned Event fields only
      await tx.event.update({
        where: { id: eventId },
        data: {
          startAt: kickoff,
          status,
          opponentName,
          competitionLabel: competition,
          location: venue,
          resultLabel,
          lastSyncedAt: context.syncedAt,
        },
      });

      // Update all SFV-owned mapping fields
      await tx.matchExternalMapping.update({
        where: { id: mappingId },
        data: mappingFields,
      });
    });

    return {
      status: "updated",
      scoreChanged:
        mappingFields.scoreHome !== null || mappingFields.scoreAway !== null,
      kickoffChanged: false,
      statusChanged: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error updating match.";
    return {
      status: "failed",
      code: "MATCH_UPDATE_FAILED",
      message: `Failed to update match for SFV matchId ${entry.matchId}: ${message}`,
    };
  }
}

// ── High-level per-record processing ──────────────────────────────────────────

/**
 * Processes a single ClubScheduleEntry: creates or updates as needed.
 *
 * Steps:
 *   1. Resolve local team IDs (home/away) from TeamExternalMapping.
 *   2. Determine which team is "ours" (the local club's team).
 *   3. If no mapping → create Event + MatchExternalMapping.
 *   4. If mapping exists → detect changes and update if needed.
 *
 * Returns a typed outcome for result accumulation in the main sync loop.
 */
export async function processScheduleEntry(
  entry: ClubScheduleEntry,
  context: SfvScheduleSyncContext,
  seasonId: string | null,
  existingMappings: Map<number, ExistingMatchMappingRow>,
  teamMappings: Map<number, string>,
): Promise<{ outcome: SchedulePersistenceOutcome; wasUnresolved: boolean }> {
  // Resolve local team IDs from the provider team IDs
  const homeTeamId = teamMappings.get(entry.teamAId) ?? null;
  const awayTeamId = teamMappings.get(entry.teamBId) ?? null;

  // Determine our local team and opponent
  const localSfvTeamIds = new Set(teamMappings.keys());
  const ourTeamIsHome = isLocalTeamId(entry.teamAId, localSfvTeamIds);
  const ourTeamIsAway = isLocalTeamId(entry.teamBId, localSfvTeamIds);

  const wasUnresolved = !ourTeamIsHome && !ourTeamIsAway;

  // Our local team FK: prefer the home side if both happen to be local
  const localTeamId = ourTeamIsHome
    ? (homeTeamId ?? null)
    : ourTeamIsAway
      ? (awayTeamId ?? null)
      : null;

  const isHome = ourTeamIsHome;
  const opponentName = resolveOpponentName(entry, isHome);

  const existing = existingMappings.get(entry.matchId);

  if (existing === undefined) {
    const outcome = await createMatchWithMapping(
      entry,
      context,
      seasonId,
      localTeamId,
      opponentName,
      isHome,
      homeTeamId,
      awayTeamId,
    );
    return { outcome, wasUnresolved };
  }

  // Detect what changed
  const incomingMapping = buildMappingFields(entry, context, homeTeamId, awayTeamId);
  const incomingKickoff = new Date(entry.matchDate);
  const incomingStatus = mapMatchStateToEventStatus(entry.matchState, entry.matchStateName);

  const changes = detectChanges(
    existing,
    existing.event,
    incomingMapping,
    incomingKickoff,
    incomingStatus,
  );

  if (!changes.hasAnyChange) {
    return { outcome: { status: "unchanged" }, wasUnresolved };
  }

  const rawOutcome = await updateMatchRecord(
    existing.id,
    existing.eventId,
    entry,
    context,
    opponentName,
    homeTeamId,
    awayTeamId,
  );

  if (rawOutcome.status === "failed") {
    return { outcome: rawOutcome, wasUnresolved };
  }

  return {
    outcome: {
      status: "updated",
      scoreChanged: changes.scoreChanged,
      kickoffChanged: changes.kickoffChanged,
      statusChanged: changes.statusChanged,
    },
    wasUnresolved,
  };
}
