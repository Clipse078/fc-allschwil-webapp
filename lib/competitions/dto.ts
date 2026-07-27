/**
 * lib/competitions/dto.ts
 *
 * Data Transfer Objects for the Competition canonical module.
 *
 * These types define the public surface of the Competition module:
 *   - CompetitionDto: the serialized form returned by queries and API routes.
 *   - CreateCompetitionInput: validated input for manual creation.
 *   - UpdateCompetitionInput: validated input for manual updates.
 *   - CompetitionFilterParams: query filter parameters.
 *
 * Architecture invariants:
 *   - All DTOs are plain serializable objects (no Prisma model instances).
 *   - tenantId is never derived from input — always from session context.
 *   - Provider-owned fields (officialName, externalIds) should not be edited
 *     manually for provider-synced competitions; updates go through sync.
 */

import type { CompetitionType, CompetitionGender } from "@prisma/client";

// ── Read DTO ──────────────────────────────────────────────────────────────────

/**
 * Canonical read representation of a Competition.
 * Safe to serialize to JSON and return from API routes.
 */
export type CompetitionDto = {
  id: string;
  tenantId: string;
  provider: string;
  externalCompetitionId: number | null;
  externalSeasonId: number | null;
  officialName: string;
  shortName: string | null;
  groupName: string | null;
  competitionType: CompetitionType;
  gender: CompetitionGender | null;
  ageCategory: string | null;
  isArchived: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Competition list item — lightweight projection for list views.
 */
export type CompetitionListItem = Pick<
  CompetitionDto,
  | "id"
  | "tenantId"
  | "provider"
  | "externalCompetitionId"
  | "externalSeasonId"
  | "officialName"
  | "shortName"
  | "groupName"
  | "competitionType"
  | "gender"
  | "ageCategory"
  | "isArchived"
  | "lastSyncedAt"
> & {
  /** Number of TeamSeason assignments for this Competition. */
  assignedTeamCount: number;
};

// ── Write DTOs ────────────────────────────────────────────────────────────────

/**
 * Input for manually creating a Competition.
 * Provider-synced competitions are created by the sync service.
 */
export type CreateCompetitionInput = {
  provider: string;
  officialName: string;
  shortName?: string;
  groupName?: string;
  competitionType?: CompetitionType;
  gender?: CompetitionGender;
  ageCategory?: string;
  externalCompetitionId?: number;
  externalSeasonId?: number;
};

/**
 * Input for updating a Competition.
 * Partial: only supplied fields are updated.
 * Provider-owned fields (officialName, externalIds) may be updated manually
 * when provider is "MANUAL".
 */
export type UpdateCompetitionInput = {
  shortName?: string;
  groupName?: string;
  competitionType?: CompetitionType;
  gender?: CompetitionGender;
  ageCategory?: string;
  isArchived?: boolean;
};

// ── Filter / Search ───────────────────────────────────────────────────────────

/**
 * Filter parameters for listing Competitions.
 */
export type CompetitionFilterParams = {
  /** Free-text search over officialName, shortName, groupName. */
  search?: string;
  /** Filter by provider (e.g. "SFV", "MANUAL"). */
  provider?: string;
  /** Filter by externalSeasonId (provider season). */
  externalSeasonId?: number;
  /** When true, include archived competitions. Default: false. */
  includeArchived?: boolean;
  /** Filter by competitionType. */
  competitionType?: CompetitionType;
  /** Filter by gender. */
  gender?: CompetitionGender;
};
