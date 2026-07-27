/**
 * lib/provider-mapping/provider-mapping-queries.ts
 *
 * Read queries for provider mappings (TeamExternalMapping rows).
 *
 * All reads are tenant-scoped. No Prisma types are returned — all results
 * are mapped to canonical DTOs before leaving this module.
 *
 * Architecture invariants:
 *   - tenantId always comes from a trusted session context.
 *   - No cross-tenant data is returned.
 *   - Provider-internal metadata is included only on explicit detail requests.
 */

import { prisma } from "@/lib/db/prisma";
import type { ProviderMappingDto, MappingSource, ConfidenceLevel } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────

type MappingRow = {
  id: string;
  tenantId: string;
  teamId: string;
  team: { name: string };
  teamSeasonId: string | null;
  teamSeason: { displayName: string } | null;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerOrganisationId: number | null;
  providerIsActive: boolean;
  mappingSource: string;
  confidenceLevel: string | null;
  mappingCompetitionId: string | null;
  mappingCompetition: { officialName: string } | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: MappingRow): ProviderMappingDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    teamId: row.teamId,
    teamName: row.team.name,
    teamSeasonId: row.teamSeasonId,
    teamSeasonDisplayName: row.teamSeason?.displayName ?? null,
    provider: row.provider,
    externalTeamId: row.externalTeamId,
    externalSeasonId: row.externalSeasonId,
    providerTeamName: row.providerTeamName,
    providerLeagueId: row.providerLeagueId,
    providerLeagueName: row.providerLeagueName,
    providerOrganisationId: row.providerOrganisationId,
    providerIsActive: row.providerIsActive,
    mappingSource: row.mappingSource as MappingSource,
    confidenceLevel: (row.confidenceLevel ?? null) as ConfidenceLevel | null,
    mappingCompetitionId: row.mappingCompetitionId,
    mappingCompetitionName: row.mappingCompetition?.officialName ?? null,
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const MAPPING_SELECT = {
  id: true,
  tenantId: true,
  teamId: true,
  team: { select: { name: true } },
  teamSeasonId: true,
  teamSeason: { select: { displayName: true } },
  provider: true,
  externalTeamId: true,
  externalSeasonId: true,
  providerTeamName: true,
  providerLeagueId: true,
  providerLeagueName: true,
  providerOrganisationId: true,
  providerIsActive: true,
  mappingSource: true,
  confidenceLevel: true,
  mappingCompetitionId: true,
  mappingCompetition: { select: { officialName: true } },
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Filter params ──────────────────────────────────────────────────────────────

export type MappingFilterParams = {
  /** Filter by provider (e.g. "SFV"). */
  provider?: string;
  /** Filter by TeamSeason ID. */
  teamSeasonId?: string;
  /** Filter by mapping source. */
  mappingSource?: MappingSource;
  /** Only return unmapped team seasons (teamSeasonId is null). */
  unmappedOnly?: boolean;
  /** Include mappings linked to archived competitions. Default: true. */
  includeArchivedCompetition?: boolean;
  /** Free-text search over team name and provider team name. */
  search?: string;
  /** Filter by competition ID (mappingCompetitionId). */
  competitionId?: string;
  /** Filter by season ID (via teamSeason.seasonId). */
  seasonId?: string;
};

// ── Public queries ─────────────────────────────────────────────────────────────

/**
 * Lists all provider mappings for a tenant, with optional filters.
 */
export async function listProviderMappings(
  tenantId: string,
  filters: MappingFilterParams = {},
): Promise<ProviderMappingDto[]> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.teamSeasonId !== undefined
        ? { teamSeasonId: filters.teamSeasonId }
        : {}),
      ...(filters.unmappedOnly ? { teamSeasonId: null } : {}),
      ...(filters.mappingSource ? { mappingSource: filters.mappingSource } : {}),
      ...(filters.competitionId ? { mappingCompetitionId: filters.competitionId } : {}),
      ...(filters.seasonId
        ? { teamSeason: { is: { seasonId: filters.seasonId } } }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { team: { name: { contains: filters.search, mode: "insensitive" as const } } },
              { providerTeamName: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: MAPPING_SELECT,
    orderBy: [{ team: { name: "asc" } }, { provider: "asc" }],
  });

  return rows.map(toDto);
}

/**
 * Gets a single provider mapping by ID for a tenant.
 * Returns null when not found or not owned by the tenant.
 */
export async function getProviderMappingById(
  tenantId: string,
  mappingId: string,
): Promise<ProviderMappingDto | null> {
  const row = await prisma.teamExternalMapping.findFirst({
    where: { id: mappingId, tenantId },
    select: MAPPING_SELECT,
  });

  return row ? toDto(row) : null;
}

/**
 * Gets all provider mappings for a specific TeamSeason.
 */
export async function getMappingsForTeamSeason(
  tenantId: string,
  teamSeasonId: string,
): Promise<ProviderMappingDto[]> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: { tenantId, teamSeasonId },
    select: MAPPING_SELECT,
    orderBy: [{ provider: "asc" }],
  });

  return rows.map(toDto);
}

/**
 * Checks whether a TeamSeason already has a mapping for a given provider.
 */
export async function teamSeasonHasMappingForProvider(
  tenantId: string,
  teamSeasonId: string,
  provider: string,
): Promise<boolean> {
  const count = await prisma.teamExternalMapping.count({
    where: { tenantId, teamSeasonId, provider },
  });
  return count > 0;
}

/**
 * Checks whether a specific external team (by externalTeamId + provider + season)
 * is already mapped for this tenant.
 */
export async function externalTeamIsMapped(
  tenantId: string,
  provider: string,
  externalTeamId: number,
  externalSeasonId: number,
): Promise<boolean> {
  const row = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId,
      provider,
      externalTeamId,
      externalSeasonId,
      teamSeasonId: { not: null },
    },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Gets all TeamSeason IDs that are mapped for a provider within a season.
 * Used by the suggestion engine to exclude already-mapped team seasons.
 */
export async function getMappedTeamSeasonIds(
  tenantId: string,
  provider: string,
): Promise<Set<string>> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      provider,
      teamSeasonId: { not: null },
    },
    select: { teamSeasonId: true },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    if (row.teamSeasonId) ids.add(row.teamSeasonId);
  }
  return ids;
}

/**
 * Gets all external team IDs that are already mapped to a TeamSeason for this provider.
 * Used to identify unmapped provider teams.
 */
export async function getMappedExternalTeamIds(
  tenantId: string,
  provider: string,
  externalSeasonId: number,
): Promise<Set<number>> {
  const rows = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId,
      provider,
      externalSeasonId,
      teamSeasonId: { not: null },
    },
    select: { externalTeamId: true },
  });

  return new Set(rows.map((r) => r.externalTeamId));
}
