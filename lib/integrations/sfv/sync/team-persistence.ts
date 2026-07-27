/**
 * lib/integrations/sfv/sync/team-persistence.ts
 *
 * Database persistence layer for the SFV team synchronization.
 *
 * Responsibilities:
 *   - Look up existing TeamExternalMapping rows for this tenant/provider/season.
 *   - Create new Team + TeamExternalMapping in a transaction on first import.
 *   - Update existing TeamExternalMapping when provider data changes.
 *   - Mark absent mappings as provider-inactive when safe to do so.
 *
 * Architecture invariants:
 *   - All queries are scoped to a single tenantId — no cross-tenant leakage.
 *   - Team fields are set only at creation. Subsequent syncs only update the
 *     mapping's provider-owned fields (never Team.name, Team.isActive, etc.).
 *   - Idempotent: running the same sync twice produces the same result.
 *   - Transactions used when creating both a Team and a mapping atomically.
 *   - No deletion: missing records are marked inactive, never deleted.
 *   - Historical integrity: teams with relations are never deleted.
 *
 * Security invariants:
 *   - tenantId always originates from a trusted session context.
 *   - No raw provider payloads are written to logs or error messages.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { TeamDetail } from "../client";
import type { SfvTeamSyncContext } from "./types";
import {
  buildNewTeamFields,
  buildMappingFields,
  hasProviderChanges,
} from "./team-mapper";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of processing a single TeamDetail against the database.
 */
export type TeamPersistenceOutcome =
  | { status: "created" }
  | { status: "updated" }
  | { status: "unchanged" }
  | { status: "failed"; code: string; message: string };

// ── Existing mapping shape ─────────────────────────────────────────────────────

type ExistingMappingRow = {
  id: string;
  teamId: string;
  providerTeamName: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerOrganisationId: number | null;
  providerIsActive: boolean;
};

// ── Lookup ─────────────────────────────────────────────────────────────────────

/**
 * Loads all existing TeamExternalMapping rows for this tenant/provider/season.
 *
 * Returns a Map keyed by externalTeamId for O(1) lookup during the sync loop.
 * All rows are scoped to a single tenantId — no cross-tenant data is loaded.
 */
export async function loadExistingMappings(
  tenantId: string,
  provider: string,
  seasonId: number,
): Promise<Map<number, ExistingMappingRow>> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: { tenantId, provider, externalSeasonId: seasonId },
    select: {
      id: true,
      teamId: true,
      externalTeamId: true,
      providerTeamName: true,
      providerLeagueId: true,
      providerLeagueName: true,
      providerOrganisationId: true,
      providerIsActive: true,
    },
  });

  const map = new Map<number, ExistingMappingRow>();
  for (const row of rows) {
    map.set(row.externalTeamId, row);
  }
  return map;
}

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new Team and its TeamExternalMapping atomically in a transaction.
 *
 * Only called when no prior mapping exists for this externalTeamId/season.
 * Team fields are set from provider data on creation and are then locally
 * managed — they will not be overwritten by subsequent syncs.
 *
 * If a Team with the generated slug already exists (edge case: another tenant
 * previously imported the same SFV teamId), the slug is made unique by
 * appending the first 8 characters of the tenantId.
 */
export async function createTeamWithMapping(
  detail: TeamDetail,
  context: SfvTeamSyncContext,
): Promise<TeamPersistenceOutcome> {
  const teamFields = buildNewTeamFields(detail, context);
  const mappingFields = buildMappingFields(detail, context);

  // TEAM-CORE-02: slug uniqueness is now tenant-scoped.
  // Check for slug conflict within the same tenant using compound key lookup.
  const slugConflict = await prisma.team.findUnique({
    where: {
      tenantId_slug: {
        tenantId: context.tenantId,
        slug: teamFields.slug,
      },
    },
    select: { id: true },
  });

  const slug =
    slugConflict !== null
      ? `${teamFields.slug}-${context.tenantId.slice(-8)}`
      : teamFields.slug;

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const team = await tx.team.create({
        data: {
          name: teamFields.name,
          slug,
          category: teamFields.category,
          tenantId: teamFields.tenantId,
          isActive: teamFields.isActive,
        },
        select: { id: true },
      });

      await tx.teamExternalMapping.create({
        data: {
          tenantId: context.tenantId,
          teamId: team.id,
          ...mappingFields,
        },
      });
    });

    return { status: "created" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error creating team.";
    return {
      status: "failed",
      code: "TEAM_CREATE_FAILED",
      message: `Failed to create team for SFV teamId ${detail.teamId}: ${message}`,
    };
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

/**
 * Updates a TeamExternalMapping with the latest provider data.
 *
 * Only called when a mapping already exists AND provider data has changed.
 * Never modifies Team fields (name, slug, category, isActive, etc.).
 * The mapping is identified by its primary key (id) — not by externalTeamId.
 */
export async function updateMappingFields(
  mappingId: string,
  detail: TeamDetail,
  context: SfvTeamSyncContext,
): Promise<TeamPersistenceOutcome> {
  const mappingFields = buildMappingFields(detail, context);

  try {
    await prisma.teamExternalMapping.update({
      where: { id: mappingId },
      data: {
        providerTeamName: mappingFields.providerTeamName,
        providerLeagueId: mappingFields.providerLeagueId,
        providerLeagueName: mappingFields.providerLeagueName,
        providerOrganisationId: mappingFields.providerOrganisationId,
        providerIsActive: mappingFields.providerIsActive,
        lastSyncedAt: mappingFields.lastSyncedAt,
      },
    });

    return { status: "updated" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error updating mapping.";
    return {
      status: "failed",
      code: "MAPPING_UPDATE_FAILED",
      message: `Failed to update mapping for SFV teamId ${detail.teamId}: ${message}`,
    };
  }
}

// ── Mark inactive ──────────────────────────────────────────────────────────────

/**
 * Marks a batch of TeamExternalMapping rows as provider-inactive.
 *
 * Only called when the full provider list was received without errors and a
 * mapping's externalTeamId was absent from the response. Never called after
 * a partial or failed API response.
 *
 * Does NOT modify Team.isActive. The inactive flag lives on the mapping only.
 * Does NOT delete any records.
 *
 * Returns the count of rows actually marked inactive (may be 0).
 */
export async function markMappingsInactive(
  mappingIds: readonly string[],
  syncedAt: Date,
): Promise<number> {
  if (mappingIds.length === 0) return 0;

  const result = await prisma.teamExternalMapping.updateMany({
    where: { id: { in: [...mappingIds] }, providerIsActive: true },
    data: { providerIsActive: false, lastSyncedAt: syncedAt },
  });

  return result.count;
}

// ── High-level per-record processing ──────────────────────────────────────────

/**
 * Processes a single TeamDetail: creates or updates as needed.
 *
 * Delegates to createTeamWithMapping or updateMappingFields based on whether
 * an existing mapping is found in the pre-loaded map.
 *
 * Returns the outcome (created / updated / unchanged / failed) for result
 * accumulation in the main sync loop.
 */
export async function processTeamDetail(
  detail: TeamDetail,
  context: SfvTeamSyncContext,
  existingMappings: Map<number, ExistingMappingRow>,
): Promise<TeamPersistenceOutcome> {
  const existing = existingMappings.get(detail.teamId);

  if (existing === undefined) {
    return createTeamWithMapping(detail, context);
  }

  const incomingFields = buildMappingFields(detail, context);
  if (!hasProviderChanges(existing, incomingFields)) {
    return { status: "unchanged" };
  }

  return updateMappingFields(existing.id, detail, context);
}
