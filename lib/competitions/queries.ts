/**
 * lib/competitions/queries.ts
 *
 * Read-only query layer for the Competition canonical module.
 *
 * All queries are tenant-scoped. tenantId must come from a trusted session
 * context — never from caller-supplied input.
 *
 * Architecture invariants:
 *   - No writes. No side effects beyond Prisma reads.
 *   - Results are plain serializable objects (CompetitionDto / CompetitionListItem).
 *   - All queries scope by tenantId first.
 */

import { prisma } from "@/lib/db/prisma";
import type { CompetitionDto, CompetitionListItem, CompetitionFilterParams } from "./dto";

// ── Mapping helpers ────────────────────────────────────────────────────────────

function toDto(row: {
  id: string;
  tenantId: string;
  provider: string;
  externalCompetitionId: number | null;
  externalSeasonId: number | null;
  officialName: string;
  shortName: string | null;
  groupName: string | null;
  competitionType: string;
  gender: string | null;
  ageCategory: string | null;
  isArchived: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CompetitionDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    externalCompetitionId: row.externalCompetitionId,
    externalSeasonId: row.externalSeasonId,
    officialName: row.officialName,
    shortName: row.shortName,
    groupName: row.groupName,
    competitionType: row.competitionType as CompetitionDto["competitionType"],
    gender: row.gender as CompetitionDto["gender"],
    ageCategory: row.ageCategory,
    isArchived: row.isArchived,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns a single Competition by ID, scoped to the given tenant.
 * Returns null when not found or not owned by the tenant.
 */
export async function getCompetitionById(
  tenantId: string,
  competitionId: string,
): Promise<CompetitionDto | null> {
  const row = await prisma.competition.findFirst({
    where: { id: competitionId, tenantId },
  });

  return row ? toDto(row) : null;
}

/**
 * Lists Competitions for a tenant with optional filtering.
 *
 * Default: excludes archived. Set includeArchived = true to include all.
 */
export async function listCompetitions(
  tenantId: string,
  params: CompetitionFilterParams = {},
): Promise<CompetitionListItem[]> {
  const {
    search,
    provider,
    externalSeasonId,
    includeArchived = false,
    competitionType,
    gender,
  } = params;

  const rows = await prisma.competition.findMany({
    where: {
      tenantId,
      ...(provider ? { provider } : {}),
      ...(externalSeasonId !== undefined ? { externalSeasonId } : {}),
      ...(!includeArchived ? { isArchived: false } : {}),
      ...(competitionType ? { competitionType } : {}),
      ...(gender ? { gender } : {}),
      ...(search
        ? {
            OR: [
              { officialName: { contains: search, mode: "insensitive" } },
              { shortName: { contains: search, mode: "insensitive" } },
              { groupName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ isArchived: "asc" }, { officialName: "asc" }],
    include: {
      _count: {
        select: { teamSeasonCompetitions: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    externalCompetitionId: row.externalCompetitionId,
    externalSeasonId: row.externalSeasonId,
    officialName: row.officialName,
    shortName: row.shortName,
    groupName: row.groupName,
    competitionType: row.competitionType as CompetitionDto["competitionType"],
    gender: row.gender as CompetitionDto["gender"],
    ageCategory: row.ageCategory,
    isArchived: row.isArchived,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    assignedTeamCount: row._count.teamSeasonCompetitions,
  }));
}

/**
 * Returns competitions eligible for team registration in a given provider season.
 *
 * Returns only non-archived competitions for the specified externalSeasonId.
 * Used by the team registration flow (TEAM-CREATE-02) and season selectors.
 *
 * When externalSeasonId is not provided, returns all non-archived competitions
 * for the tenant.
 */
export async function getEligibleCompetitions(
  tenantId: string,
  externalSeasonId?: number,
): Promise<CompetitionListItem[]> {
  return listCompetitions(tenantId, {
    externalSeasonId,
    includeArchived: false,
  });
}

/**
 * Resolves a Competition by provider + external identifiers.
 *
 * Used by Matchcenter to locate the canonical Competition for a provider match.
 * Returns null when no matching competition exists.
 *
 * Resolver is tenant-scoped: the returned competition belongs to the tenant.
 */
export async function resolveCompetitionByProviderIds(
  tenantId: string,
  provider: string,
  externalCompetitionId: number,
  externalSeasonId: number,
): Promise<CompetitionDto | null> {
  const row = await prisma.competition.findUnique({
    where: {
      tenantId_provider_externalCompetitionId_externalSeasonId: {
        tenantId,
        provider,
        externalCompetitionId,
        externalSeasonId,
      },
    },
  });

  return row ? toDto(row) : null;
}
