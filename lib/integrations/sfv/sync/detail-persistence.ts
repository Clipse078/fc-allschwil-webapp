/**
 * lib/integrations/sfv/sync/detail-persistence.ts
 *
 * Database persistence layer for the SFV match-detail synchronization (Slice 3C).
 *
 * Responsibilities:
 *   - Load existing MatchExternalMapping rows for a tenant (limited to season).
 *   - Apply provider-managed field updates to linked Events.
 *   - Update MatchExternalMapping.detailSyncedAt on every successful detail sync.
 *
 * Architecture invariants:
 *   - All queries are scoped to a single tenantId — no cross-tenant leakage.
 *   - This layer NEVER creates Events. Only existing mappings are processed.
 *   - Only a strictly defined set of provider-managed Event fields is updated:
 *       startAt, status, location, competitionLabel, intermediateResultLabel
 *   - Club-managed fields are NEVER touched:
 *       title, remarks, meetingTime, pitchCode, homeDressingRoomCode,
 *       awayDressingRoomCode, websiteVisible, infoboardVisible,
 *       wochenplanVisible, homepageVisible, trainingsplanVisible,
 *       teamPageVisible, sortOrder, reviewStage, reviewNotes, teamId,
 *       seasonId, opponentName, resultLabel, homeAway
 *   - Idempotent: running the same sync twice produces the same result,
 *     with only detailSyncedAt differing.
 *   - Transactions used for atomicity: Event.update + mapping.detailSyncedAt update.
 *
 * Security invariants:
 *   - tenantId always originates from a trusted session context.
 *   - No raw provider payloads are written to logs or error messages.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { MatchDetail } from "../client";
import type { SfvDetailSyncContext } from "./detail-types";
import { mapMatchStateToEventStatus } from "./schedule-mapper";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Minimal projection of a MatchExternalMapping row for detail sync.
 *
 * Only the fields needed to identify the linked Event and detect changes are
 * selected. Club-managed fields are not loaded — they are irrelevant here.
 */
export type DetailSyncMappingRow = {
  id: string;
  externalMatchId: number;
  eventId: string;
  event: {
    startAt: Date;
    status: string;
    location: string | null;
    competitionLabel: string | null;
    intermediateResultLabel: string | null;
  };
};

/**
 * Result of processing a single MatchExternalMapping during detail sync.
 */
export type DetailPersistenceOutcome =
  | { status: "updated" }
  | { status: "unchanged" }
  | { status: "failed"; code: string; message: string };

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Loads all MatchExternalMapping rows for this tenant/provider/season.
 *
 * Returns a list suitable for iteration during the sync loop.
 * All rows are scoped to a single tenantId — no cross-tenant data is loaded.
 *
 * Only provider-managed fields from the linked Event are selected. Club-managed
 * fields are not loaded and must not be used by this layer.
 */
export async function loadMappingsForDetailSync(
  tenantId: string,
  provider: string,
  seasonId: number,
): Promise<DetailSyncMappingRow[]> {
  return prisma.matchExternalMapping.findMany({
    where: { tenantId, provider, externalSeasonId: seasonId },
    select: {
      id: true,
      externalMatchId: true,
      eventId: true,
      event: {
        select: {
          startAt: true,
          status: true,
          location: true,
          competitionLabel: true,
          intermediateResultLabel: true,  // nullable — only set by detail sync
        },
      },
    },
  });
}

// ── Change detection ───────────────────────────────────────────────────────────

/**
 * Parses an SFV match date consistently.
 *
 * SFV may return an ISO timestamp without an explicit timezone. Those values
 * represent UTC provider timestamps and must not be interpreted in the
 * server's local timezone.
 */
function parseProviderMatchDate(matchDate: string): Date {
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(matchDate);
  return new Date(hasExplicitTimezone ? matchDate : `${matchDate}Z`);
}

/**
 * Determines whether the incoming MatchDetail requires an Event update.
 *
 * Compares only provider-managed fields. Club-managed fields are not compared.
 */
export function detectDetailChanges(
  existing: DetailSyncMappingRow["event"],
  detail: MatchDetail,
): boolean {
  const incomingKickoff = parseProviderMatchDate(detail.matchDate);
  const incomingStatus = mapMatchStateToEventStatus(detail.matchState, detail.matchStateName);
  const incomingLocation = detail.playgroundName ?? null;
  const incomingCompetition = detail.leagueName ?? detail.divisionName ?? null;
  const incomingIntermediate = buildIntermediateResultLabel(
    detail.intermediateScoreHome,
    detail.intermediateScoreAway,
  );

  if (existing.startAt.getTime() !== incomingKickoff.getTime()) return true;
  if (existing.status !== incomingStatus) return true;
  if (existing.location !== incomingLocation) return true;
  if (existing.competitionLabel !== incomingCompetition) return true;
  if (existing.intermediateResultLabel !== incomingIntermediate) return true;

  return false;
}

// ── Persistence ────────────────────────────────────────────────────────────────

/**
 * Applies provider-managed field updates to an existing Event, and stamps
 * detailSyncedAt on the corresponding MatchExternalMapping.
 *
 * STRICTLY LIMITED to provider-managed fields:
 *   startAt, status, location, competitionLabel, intermediateResultLabel
 *
 * All other Event fields — including title, remarks, meetingTime, pitchCode,
 * homeDressingRoomCode, awayDressingRoomCode, visibility flags, reviewStage,
 * seasonId, teamId, opponentName, resultLabel, homeAway — are NOT part of
 * the update payload and are therefore guaranteed to remain unchanged.
 *
 * The MatchExternalMapping is not re-linked; its eventId is preserved exactly.
 */
export async function applyDetailUpdate(
  mapping: DetailSyncMappingRow,
  detail: MatchDetail,
  context: SfvDetailSyncContext,
): Promise<DetailPersistenceOutcome> {
  const kickoff = parseProviderMatchDate(detail.matchDate);
  const status = mapMatchStateToEventStatus(detail.matchState, detail.matchStateName);
  const location = detail.playgroundName ?? null;
  const competition = detail.leagueName ?? detail.divisionName ?? null;
  const intermediateResultLabel = buildIntermediateResultLabel(
    detail.intermediateScoreHome,
    detail.intermediateScoreAway,
  );

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update only provider-managed Event fields.
      // Club-managed fields are NOT in this payload and remain untouched.
      await tx.event.update({
        where: { id: mapping.eventId },
        data: {
          startAt: kickoff,
          status,
          location,
          competitionLabel: competition,
          intermediateResultLabel,
          lastSyncedAt: context.syncedAt,
        },
      });

      // Stamp the mapping with the detail sync timestamp.
      await tx.matchExternalMapping.update({
        where: { id: mapping.id },
        data: { detailSyncedAt: context.syncedAt },
      });
    });

    return { status: "updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error updating match detail.";
    return {
      status: "failed",
      code: "DETAIL_UPDATE_FAILED",
      message: `Failed to apply detail update for externalMatchId ${detail.matchId}: ${message}`,
    };
  }
}

/**
 * Stamps detailSyncedAt on the MatchExternalMapping without updating the Event.
 *
 * Used when no provider-managed Event fields have changed. Ensures that
 * detailSyncedAt reflects the latest sync run even when nothing changed.
 */
export async function stampDetailSyncedAt(
  mappingId: string,
  syncedAt: Date,
): Promise<DetailPersistenceOutcome> {
  try {
    await prisma.matchExternalMapping.update({
      where: { id: mappingId },
      data: { detailSyncedAt: syncedAt },
    });
    return { status: "unchanged" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error stamping detailSyncedAt.";
    return {
      status: "failed",
      code: "DETAIL_STAMP_FAILED",
      message: `Failed to stamp detailSyncedAt for mappingId ${mappingId}: ${message}`,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds the intermediate result label from live/half-time scores.
 *
 * Returns null when no intermediate score is available (scores are null).
 * Returns "X:Y (HZ)" format when intermediate scores are present.
 */
export function buildIntermediateResultLabel(
  home: number | null | undefined,
  away: number | null | undefined,
): string | null {
  if (home === null || home === undefined || away === null || away === undefined) {
    return null;
  }
  return `${home}:${away} (HZ)`;
}
