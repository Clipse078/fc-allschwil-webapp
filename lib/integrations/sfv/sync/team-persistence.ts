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
import { SFV_PROVIDER } from "../season-bridge";
import { resolveTeamSeasonIdForExternalMapping } from "../team-season-resolution";
import type { SfvTeamSyncContext } from "./types";
import {
  buildNewTeamFields,
  buildMappingFields,
  hasProviderChanges,
} from "./team-mapper";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of processing a single TeamDetail against the database.
 *
 * "relinked" (TEAM-SFV-MAPPING-01): the SFV teamId already has a canonical
 * Team from a prior season sync (e.g. the tenant's configured SFV season
 * advanced from 2026 to 2027). Only a new TeamExternalMapping row was
 * created for the new season — the existing canonical Team was reused.
 * Distinguished from "created" so admins can see that no new physical team
 * was introduced.
 */
export type TeamPersistenceOutcome =
  | { status: "created" }
  | { status: "relinked" }
  | { status: "updated" }
  | { status: "unchanged" }
  | { status: "failed"; code: string; message: string };

// ── Existing mapping shape ─────────────────────────────────────────────────────

type ExistingMappingRow = {
  id: string;
  teamId: string;
  teamSeasonId: string | null;
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
      teamSeasonId: true,
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

/**
 * Loads the most recently synced canonical teamId for every externalTeamId
 * previously mapped for this tenant/provider in a season OTHER than the one
 * currently being synced (TEAM-SFV-MAPPING-01 — season carryover).
 *
 * Root cause this addresses: `loadExistingMappings` above is scoped to a
 * single `externalSeasonId`. Whenever a tenant's configured SFV season
 * advances (e.g. 2026 → 2027), every previously-known team appears "new" to
 * that season-scoped lookup even though the real-world team — identified by
 * its stable SFV teamId — already has a canonical Team. Without this
 * fallback, `createTeamWithMapping` would create a brand-new duplicate Team
 * every season, which is the exact "many indistinguishable FC Allschwil
 * rows" defect this slice fixes.
 *
 * SFV teamId is the sole authority for identity here — never team name,
 * since provider names may differ slightly season to season (rename,
 * league suffix change, etc.) without the underlying team changing.
 *
 * When multiple historical rows exist for the same externalTeamId (one per
 * season previously synced), the most recently synced one wins.
 */
export async function loadCrossSeasonTeamIds(
  tenantId: string,
  provider: string,
  currentSeasonId: number,
): Promise<Map<number, string>> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: { tenantId, provider, externalSeasonId: { not: currentSeasonId } },
    orderBy: { lastSyncedAt: "desc" },
    select: { externalTeamId: true, teamId: true },
  });

  const map = new Map<number, string>();
  for (const row of rows) {
    if (!map.has(row.externalTeamId)) {
      map.set(row.externalTeamId, row.teamId);
    }
  }
  return map;
}

async function resolveTeamSeasonIdForSync(
  teamId: string,
  context: SfvTeamSyncContext,
): Promise<string | null> {
  return resolveTeamSeasonIdForExternalMapping({
    tenantId: context.tenantId,
    teamId,
    provider: SFV_PROVIDER,
    externalSeasonId: context.seasonId,
  });
}

async function linkMappingTeamSeasonIfResolvable(
  mappingId: string,
  teamId: string,
  existingTeamSeasonId: string | null,
  context: SfvTeamSyncContext,
): Promise<TeamPersistenceOutcome> {
  if (existingTeamSeasonId !== null) {
    return { status: "unchanged" };
  }

  const teamSeasonId = await resolveTeamSeasonIdForSync(teamId, context);
  if (teamSeasonId === null) {
    return { status: "unchanged" };
  }

  try {
    await prisma.teamExternalMapping.updateMany({
      where: { id: mappingId, teamSeasonId: null },
      data: { teamSeasonId },
    });
    return { status: "updated" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error linking TeamSeason.";
    return {
      status: "failed",
      code: "TEAM_SEASON_LINK_FAILED",
      message: `Failed to link TeamSeason for mapping ${mappingId}: ${message}`,
    };
  }
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

      const resolvedTeamSeasonId = await resolveTeamSeasonIdForExternalMapping({
        tenantId: context.tenantId,
        teamId: team.id,
        provider: SFV_PROVIDER,
        externalSeasonId: context.seasonId,
      });

      await tx.teamExternalMapping.create({
        data: {
          tenantId: context.tenantId,
          teamId: team.id,
          teamSeasonId: resolvedTeamSeasonId,
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

// ── Relink (season carryover) ─────────────────────────────────────────────────

/**
 * Links an SFV team to its EXISTING canonical Team for a new season by
 * creating only a new TeamExternalMapping row — never a new Team.
 *
 * Called when `loadCrossSeasonTeamIds` found a canonical teamId for this
 * externalTeamId from a prior season. Provider IDs are authoritative
 * (TEAM-SFV-MAPPING-01): the same SFV teamId always resolves to the same
 * canonical Team, regardless of season or provider name changes.
 *
 * Defensively re-verifies the Team still exists for this tenant before
 * linking. If it does not (e.g. deleted outside the sync pipeline), falls
 * back to creating a new Team rather than failing the whole sync — this
 * mirrors the very first import path exactly.
 */
export async function linkExistingTeamToNewSeason(
  teamId: string,
  detail: TeamDetail,
  context: SfvTeamSyncContext,
): Promise<TeamPersistenceOutcome> {
  const mappingFields = buildMappingFields(detail, context);

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, tenantId: context.tenantId },
      select: { id: true },
    });

    if (!team) {
      return createTeamWithMapping(detail, context);
    }

    const resolvedTeamSeasonId = await resolveTeamSeasonIdForSync(teamId, context);

    await prisma.teamExternalMapping.create({
      data: {
        tenantId: context.tenantId,
        teamId,
        teamSeasonId: resolvedTeamSeasonId,
        ...mappingFields,
      },
    });

    return { status: "relinked" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error linking team to new season.";
    return {
      status: "failed",
      code: "TEAM_RELINK_FAILED",
      message: `Failed to link SFV teamId ${detail.teamId} to its existing canonical team for season ${context.seasonId}: ${message}`,
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
  teamId: string,
  detail: TeamDetail,
  context: SfvTeamSyncContext,
  existingTeamSeasonId: string | null = null,
): Promise<TeamPersistenceOutcome> {
  const mappingFields = buildMappingFields(detail, context);
  const resolvedTeamSeasonId =
    existingTeamSeasonId === null
      ? await resolveTeamSeasonIdForSync(teamId, context)
      : null;

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
        ...(existingTeamSeasonId === null && resolvedTeamSeasonId
          ? { teamSeasonId: resolvedTeamSeasonId }
          : {}),
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
 * Processes a single TeamDetail: creates, relinks, or updates as needed.
 *
 * Resolution order:
 *   1. A mapping already exists for THIS season → update or leave unchanged.
 *   2. No mapping for this season, but a canonical Team already exists from
 *      a PRIOR season (TEAM-SFV-MAPPING-01 season carryover) → relink
 *      (new mapping row only, reusing the existing Team — never duplicated).
 *   3. Otherwise → true first-time import (create Team + mapping).
 *
 * `crossSeasonTeamIds` defaults to an empty map for backward compatibility;
 * callers should always pass the result of `loadCrossSeasonTeamIds`.
 *
 * Returns the outcome (created / relinked / updated / unchanged / failed)
 * for result accumulation in the main sync loop.
 */
export async function processTeamDetail(
  detail: TeamDetail,
  context: SfvTeamSyncContext,
  existingMappings: Map<number, ExistingMappingRow>,
  crossSeasonTeamIds: Map<number, string> = new Map(),
): Promise<TeamPersistenceOutcome> {
  const existing = existingMappings.get(detail.teamId);

  if (existing === undefined) {
    const priorTeamId = crossSeasonTeamIds.get(detail.teamId);
    if (priorTeamId !== undefined) {
      return linkExistingTeamToNewSeason(priorTeamId, detail, context);
    }
    return createTeamWithMapping(detail, context);
  }

  const incomingFields = buildMappingFields(detail, context);
  if (!hasProviderChanges(existing, incomingFields)) {
    if (existing.teamSeasonId === null) {
      return linkMappingTeamSeasonIfResolvable(
        existing.id,
        existing.teamId,
        existing.teamSeasonId,
        context,
      );
    }
    return { status: "unchanged" };
  }

  return updateMappingFields(
    existing.id,
    existing.teamId,
    detail,
    context,
    existing.teamSeasonId,
  );
}
