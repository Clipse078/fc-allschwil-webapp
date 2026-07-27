/**
 * lib/integrations/sfv/sync/competition-persistence.ts
 *
 * Database persistence layer for SFV competition synchronization.
 *
 * Responsibilities:
 *   - Load existing Competition rows for this tenant/provider/season.
 *   - Upsert Competition rows idempotently.
 *   - Archive competitions absent from the current provider response.
 *
 * Architecture invariants:
 *   - All queries are scoped to a single tenantId — no cross-tenant leakage.
 *   - Idempotent: running the same sync twice produces the same DB state.
 *   - No deletion: absent competitions are archived (isArchived = true).
 *   - Only provider-owned fields (officialName, groupName) are updated.
 *     Local overrides (shortName, ageCategory, competitionType set by admin)
 *     are never overwritten by sync.
 *
 * Security invariants:
 *   - tenantId always originates from a trusted session context.
 */

import { prisma } from "@/lib/db/prisma";
import type { ExtractedSfvCompetition, SfvCompetitionSyncContext } from "./competition-types";
import {
  hasCompetitionChanges,
  inferCompetitionGender,
} from "./competition-mapper";

const PROVIDER = "SFV";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CompetitionPersistenceOutcome =
  | { status: "created" }
  | { status: "updated" }
  | { status: "unchanged" }
  | { status: "failed"; code: string; message: string };

type ExistingRow = {
  id: string;
  externalCompetitionId: number | null;
  officialName: string;
  groupName: string | null;
  isArchived: boolean;
};

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Loads all existing Competition rows for this tenant/provider/season.
 *
 * Returns a Map keyed by externalCompetitionId for O(1) lookup.
 */
export async function loadExistingCompetitions(
  tenantId: string,
  externalSeasonId: number,
): Promise<Map<number, ExistingRow>> {
  const rows = await prisma.competition.findMany({
    where: { tenantId, provider: PROVIDER, externalSeasonId },
    select: {
      id: true,
      externalCompetitionId: true,
      officialName: true,
      groupName: true,
      isArchived: true,
    },
  });

  const map = new Map<number, ExistingRow>();
  for (const row of rows) {
    if (row.externalCompetitionId !== null) {
      map.set(row.externalCompetitionId, row);
    }
  }
  return map;
}

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new canonical Competition row for an SFV competition.
 *
 * Only called when no prior Competition row exists for this
 * (tenantId, provider, externalCompetitionId, externalSeasonId).
 */
export async function createCompetitionRow(
  competition: ExtractedSfvCompetition,
  context: SfvCompetitionSyncContext,
): Promise<CompetitionPersistenceOutcome> {
  try {
    await prisma.competition.create({
      data: {
        tenantId: context.tenantId,
        provider: PROVIDER,
        externalCompetitionId: competition.externalCompetitionId,
        externalSeasonId: competition.externalSeasonId,
        officialName: competition.officialName,
        groupName: competition.groupName,
        gender: inferCompetitionGender(competition.officialName),
        competitionType: "LEAGUE",
        isArchived: false,
        lastSyncedAt: context.syncedAt,
      },
    });

    return { status: "created" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating competition.";
    return {
      status: "failed",
      code: "COMPETITION_CREATE_FAILED",
      message: `Failed to create competition for SFV leagueId ${competition.externalCompetitionId}: ${message}`,
    };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

/**
 * Updates provider-owned fields on an existing Competition row.
 *
 * Never overwrites locally-managed fields (shortName, ageCategory,
 * competitionType set by admin, isArchived when manually set).
 *
 * Also unarchives competitions that reappear after being absent from
 * a previous sync.
 */
export async function updateCompetitionRow(
  competitionId: string,
  competition: ExtractedSfvCompetition,
  context: SfvCompetitionSyncContext,
  wasArchived: boolean,
): Promise<CompetitionPersistenceOutcome> {
  try {
    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        officialName: competition.officialName,
        groupName: competition.groupName,
        lastSyncedAt: context.syncedAt,
        ...(wasArchived ? { isArchived: false } : {}),
      },
    });

    return { status: "updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error updating competition.";
    return {
      status: "failed",
      code: "COMPETITION_UPDATE_FAILED",
      message: `Failed to update competition ${competitionId}: ${message}`,
    };
  }
}

// ── Archive absent ─────────────────────────────────────────────────────────────

/**
 * Archives competitions that were absent from the current sync response.
 *
 * Only called when the full provider list was received without errors and the
 * provider returned at least one team. A zero-response after a populated
 * season must NOT archive all competitions (could be a transient API error).
 *
 * Returns the count of competitions actually archived.
 */
export async function archiveAbsentCompetitions(
  competitionIds: readonly string[],
  syncedAt: Date,
): Promise<number> {
  if (competitionIds.length === 0) return 0;

  const result = await prisma.competition.updateMany({
    where: { id: { in: [...competitionIds] }, isArchived: false },
    data: { isArchived: true, lastSyncedAt: syncedAt },
  });

  return result.count;
}

// ── Per-record processing ──────────────────────────────────────────────────────

/**
 * Processes a single extracted competition: creates or updates as needed.
 *
 * Returns the outcome for result accumulation in the sync orchestrator.
 */
export async function processCompetition(
  competition: ExtractedSfvCompetition,
  context: SfvCompetitionSyncContext,
  existingMap: Map<number, ExistingRow>,
): Promise<CompetitionPersistenceOutcome> {
  const existing = existingMap.get(competition.externalCompetitionId);

  if (existing === undefined) {
    return createCompetitionRow(competition, context);
  }

  const needsUpdate =
    hasCompetitionChanges(existing, competition) || existing.isArchived;

  if (!needsUpdate) {
    // Still touch lastSyncedAt to record that this competition was seen.
    await prisma.competition.update({
      where: { id: existing.id },
      data: { lastSyncedAt: context.syncedAt },
    });
    return { status: "unchanged" };
  }

  return updateCompetitionRow(existing.id, competition, context, existing.isArchived);
}
