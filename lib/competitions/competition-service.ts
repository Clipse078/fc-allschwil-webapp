/**
 * lib/competitions/competition-service.ts
 *
 * Domain service for Competition CRUD operations.
 *
 * Handles manual creation, updates, and archival of Competition records.
 * Provider-synced competitions are created and updated by competition-sync-service.
 *
 * Architecture invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - Validation is performed before any DB write.
 *   - No deletion: competitions are archived (isArchived = true), not deleted.
 *   - Idempotent upsert uses the composite unique key for provider-synced records.
 *
 * Security invariants:
 *   - All DB queries are scoped to tenantId.
 *   - Tenant A cannot read or modify Tenant B's competitions.
 */

import { prisma } from "@/lib/db/prisma";
import type { CompetitionDto, CreateCompetitionInput, UpdateCompetitionInput } from "./dto";
import {
  validateCreateCompetitionInput,
  validateUpdateCompetitionInput,
  CompetitionValidationError,
} from "./validators";
export { CompetitionValidationError };

// ── Error types ────────────────────────────────────────────────────────────────

export class CompetitionNotFoundError extends Error {
  constructor(competitionId: string) {
    super(`Competition not found: ${competitionId}`);
    this.name = "CompetitionNotFoundError";
  }
}

export class CompetitionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompetitionConflictError";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Public service functions ───────────────────────────────────────────────────

/**
 * Creates a new Competition manually.
 *
 * Validates input before writing. Prevents duplicates via the unique constraint
 * on (tenantId, provider, externalCompetitionId, externalSeasonId).
 *
 * @throws {CompetitionValidationError}  Input validation failed.
 * @throws {CompetitionConflictError}    A competition with the same external IDs exists.
 */
export async function createCompetition(
  tenantId: string,
  input: CreateCompetitionInput,
): Promise<CompetitionDto> {
  validateCreateCompetitionInput(input);

  try {
    const row = await prisma.competition.create({
      data: {
        tenantId,
        provider: input.provider.trim(),
        externalCompetitionId: input.externalCompetitionId ?? null,
        externalSeasonId: input.externalSeasonId ?? null,
        officialName: input.officialName.trim(),
        shortName: input.shortName?.trim() ?? null,
        groupName: input.groupName?.trim() ?? null,
        competitionType: input.competitionType ?? "LEAGUE",
        gender: input.gender ?? null,
        ageCategory: input.ageCategory?.trim() ?? null,
        isArchived: false,
      },
    });

    return toDto(row);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint") &&
      err.message.includes("Competition")
    ) {
      throw new CompetitionConflictError(
        `A competition with provider="${input.provider}", externalCompetitionId=${input.externalCompetitionId}, externalSeasonId=${input.externalSeasonId} already exists for this tenant.`,
      );
    }
    throw err;
  }
}

/**
 * Updates a Competition's locally-managed fields.
 *
 * Provider-owned fields (officialName, externalIds) are not updatable here.
 * Those are managed by the sync service.
 *
 * @throws {CompetitionValidationError}  Input validation failed.
 * @throws {CompetitionNotFoundError}    Competition does not exist for this tenant.
 */
export async function updateCompetition(
  tenantId: string,
  competitionId: string,
  input: UpdateCompetitionInput,
): Promise<CompetitionDto> {
  validateUpdateCompetitionInput(input);

  const existing = await prisma.competition.findFirst({
    where: { id: competitionId, tenantId },
    select: { id: true },
  });

  if (!existing) {
    throw new CompetitionNotFoundError(competitionId);
  }

  const row = await prisma.competition.update({
    where: { id: competitionId },
    data: {
      ...(input.officialName !== undefined ? { officialName: input.officialName.trim() } : {}),
      ...(input.shortName !== undefined ? { shortName: input.shortName?.trim() ?? null } : {}),
      ...(input.groupName !== undefined ? { groupName: input.groupName?.trim() ?? null } : {}),
      ...(input.competitionType !== undefined ? { competitionType: input.competitionType } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.ageCategory !== undefined
        ? { ageCategory: input.ageCategory?.trim() ?? null }
        : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
    },
  });

  return toDto(row);
}

/**
 * Archives a Competition (sets isArchived = true).
 *
 * Competitions are never hard-deleted. Archival hides them from active
 * workflows while preserving historical references.
 *
 * @throws {CompetitionNotFoundError}  Competition does not exist for this tenant.
 */
export async function archiveCompetition(
  tenantId: string,
  competitionId: string,
): Promise<CompetitionDto> {
  return updateCompetition(tenantId, competitionId, { isArchived: true });
}

/**
 * Unarchives a Competition (sets isArchived = false).
 *
 * @throws {CompetitionNotFoundError}  Competition does not exist for this tenant.
 */
export async function unarchiveCompetition(
  tenantId: string,
  competitionId: string,
): Promise<CompetitionDto> {
  return updateCompetition(tenantId, competitionId, { isArchived: false });
}
