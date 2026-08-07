/**
 * lib/club-directory/types.ts
 *
 * CLUB-DIRECTORY-01 — shared DTO and input types for the canonical external
 * club/team directory. Kept provider-agnostic: "SFV" is just a string value
 * of `provider`, never hard-coded into a type.
 */

// ── Provider mapping DTOs ──────────────────────────────────────────────────────

export type ExternalClubProviderMappingDto = {
  id: string;
  provider: string;
  providerClubId: number;
  providerClubName: string | null;
  providerLogoUrl: string | null;
  providerWebsite: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date | null;
};

export type ExternalTeamProviderMappingDto = {
  id: string;
  provider: string;
  providerTeamId: number;
  providerSeasonId: number;
  providerTeamName: string | null;
  providerClubId: number | null;
  providerOrganisationId: number | null;
  providerLogoUrl: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date | null;
};

// ── ExternalClub DTOs ──────────────────────────────────────────────────────────

export type ExternalClubSummaryDto = {
  id: string;
  tenantId: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  logoUrl: string | null;
  source: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Number of ExternalTeam rows currently attached (active + archived). */
  teamCount: number;
  /** True when at least one ExternalClubProviderMapping exists. */
  hasProviderMapping: boolean;
};

export type ExternalTeamSummaryDto = {
  id: string;
  tenantId: string;
  externalClubId: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  categoryLabel: string | null;
  logoUrl: string | null;
  source: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  providerMappings: ExternalTeamProviderMappingDto[];
};

export type ExternalClubDetailDto = ExternalClubSummaryDto & {
  website: string | null;
  location: string | null;
  notes: string | null;
  providerMappings: ExternalClubProviderMappingDto[];
  teams: ExternalTeamSummaryDto[];
};

export type ExternalTeamDetailDto = ExternalTeamSummaryDto & {
  externalClub: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    archivedAt: Date | null;
  };
};

// ── List/query inputs ──────────────────────────────────────────────────────────

export type ExternalClubListInput = {
  tenantId: string;
  /** Case-insensitive substring match against name / shortName / alternativeName. */
  search?: string;
  limit?: number;
  skip?: number;
  includeArchived?: boolean;
};

export type ExternalClubDetailInput = {
  tenantId: string;
  id: string;
};

export type ExternalTeamListInput = {
  tenantId: string;
  externalClubId?: string;
  search?: string;
  limit?: number;
  skip?: number;
  includeArchived?: boolean;
};

export type ExternalTeamDetailInput = {
  tenantId: string;
  id: string;
};

export type ProviderIdentityLookupInput = {
  tenantId: string;
  provider: string;
  providerTeamId: number;
};
