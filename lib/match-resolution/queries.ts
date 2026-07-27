/**
 * lib/match-resolution/queries.ts
 *
 * Read-only database queries for the Match Resolution layer (MATCH-RESOLUTION-01).
 *
 * Responsibilities:
 *   - Load TeamExternalMapping rows for team-side resolution.
 *   - Load Competition rows for competition validation context.
 *   - Load MatchExternalMapping rows for batch resolution.
 *   - Check TeamSeasonCompetition membership for competition validation.
 *
 * Architecture invariants:
 *   - All queries are tenant-scoped — no cross-tenant data is ever returned.
 *   - No provider-specific logic. Provider key is treated as a plain string.
 *   - No writes. All mutations happen in match-resolution-service.ts.
 *   - No fuzzy matching — only exact canonical lookups.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TeamMappingForResolution,
  MatchMappingForResolution,
  CompetitionForResolution,
} from "./types";

// ── Team mapping lookup ───────────────────────────────────────────────────────

/**
 * Loads a TeamExternalMapping row for the given provider team identity.
 *
 * Returns the first matching row (there should be at most one due to the
 * unique constraint on [tenantId, provider, externalTeamId, externalSeasonId]).
 *
 * Includes the linked TeamSeason (when present) and the team's tenantId
 * for tenant isolation validation.
 *
 * All lookups are scoped to the given tenantId — no cross-tenant leakage.
 */
export async function findTeamMappingForResolution(
  tenantId: string,
  provider: string,
  externalTeamId: number,
  externalSeasonId: number,
): Promise<TeamMappingForResolution | null> {
  const row = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId,
      provider,
      externalTeamId,
      externalSeasonId,
    },
    select: {
      externalTeamId: true,
      teamSeasonId: true,
      teamId: true,
      providerIsActive: true,
      teamSeason: {
        select: {
          id: true,
          status: true,
          team: {
            select: { tenantId: true },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    externalTeamId: row.externalTeamId,
    teamSeasonId: row.teamSeasonId,
    teamId: row.teamId,
    providerIsActive: row.providerIsActive,
    teamSeason: row.teamSeason
      ? {
          id: row.teamSeason.id,
          status: row.teamSeason.status,
          team: { tenantId: row.teamSeason.team.tenantId },
        }
      : null,
  };
}

/**
 * Returns the count of TeamExternalMapping rows for a given provider team
 * within this tenant. Used to detect duplicate mapping conflicts.
 *
 * A count > 1 indicates a data integrity problem — the unique DB constraint
 * should prevent this, but the service layer checks defensively.
 */
export async function countTeamMappings(
  tenantId: string,
  provider: string,
  externalTeamId: number,
  externalSeasonId: number,
): Promise<number> {
  return prisma.teamExternalMapping.count({
    where: {
      tenantId,
      provider,
      externalTeamId,
      externalSeasonId,
    },
  });
}

// ── Competition lookup ────────────────────────────────────────────────────────

/**
 * Looks up a canonical Competition by provider competition identifier.
 *
 * Returns the first matching active (non-archived) or archived competition.
 * The caller is responsible for checking isArchived before using the result.
 *
 * Returns null when no competition matches the given identifiers.
 */
export async function findCompetitionForResolution(
  tenantId: string,
  provider: string,
  externalCompetitionId: number,
  externalSeasonId: number,
): Promise<CompetitionForResolution | null> {
  const row = await prisma.competition.findFirst({
    where: {
      tenantId,
      provider,
      externalCompetitionId,
      externalSeasonId,
    },
    select: {
      id: true,
      externalCompetitionId: true,
      isArchived: true,
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    externalCompetitionId: row.externalCompetitionId,
    isArchived: row.isArchived,
  };
}

// ── Competition membership validation ─────────────────────────────────────────

/**
 * Returns true when the given TeamSeason is registered for the given Competition.
 *
 * Used to validate that a resolved TeamSeason belongs to the expected competition.
 * A mismatch is a warning (not an error) since the resolver uses TeamExternalMapping
 * as the authoritative source, not Competition membership.
 */
export async function isTeamSeasonInCompetition(
  teamSeasonId: string,
  competitionId: string,
): Promise<boolean> {
  const row = await prisma.teamSeasonCompetition.findFirst({
    where: { teamSeasonId, competitionId },
    select: { id: true },
  });
  return row !== null;
}

// ── Batch match mapping loader ────────────────────────────────────────────────

/**
 * Loads all MatchExternalMapping rows for the given tenant/provider/season scope.
 *
 * Returns only the fields needed by the resolution service.
 * All rows are scoped to the given tenantId — no cross-tenant data is returned.
 */
export async function loadMatchMappingsForResolution(
  tenantId: string,
  provider: string,
  externalSeasonId: number,
): Promise<MatchMappingForResolution[]> {
  const rows = await prisma.matchExternalMapping.findMany({
    where: {
      tenantId,
      provider,
      externalSeasonId,
    },
    select: {
      id: true,
      externalMatchId: true,
      externalSeasonId: true,
      providerHomeTeamId: true,
      providerAwayTeamId: true,
      providerLeagueId: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    externalMatchId: r.externalMatchId,
    externalSeasonId: r.externalSeasonId,
    providerHomeTeamId: r.providerHomeTeamId,
    providerAwayTeamId: r.providerAwayTeamId,
    providerLeagueId: r.providerLeagueId,
  }));
}

// ── Resolution result persistence ─────────────────────────────────────────────

/**
 * Persists the resolution result to the MatchExternalMapping row.
 *
 * Writes:
 *   - resolvedHomeTeamSeasonId
 *   - resolvedAwayTeamSeasonId
 *   - resolvedCompetitionId
 *   - resolutionStatus
 *   - resolvedAt
 *
 * This is the only write operation in the queries layer.
 * Called by the service after each successful resolution.
 */
export async function persistMatchResolution(
  mappingId: string,
  resolvedHomeTeamSeasonId: string | null,
  resolvedAwayTeamSeasonId: string | null,
  resolvedCompetitionId: string | null,
  resolutionStatus: string,
  resolvedAt: Date,
): Promise<void> {
  await prisma.matchExternalMapping.update({
    where: { id: mappingId },
    data: {
      resolvedHomeTeamSeasonId,
      resolvedAwayTeamSeasonId,
      resolvedCompetitionId,
      resolutionStatus,
      resolvedAt,
    },
  });
}
