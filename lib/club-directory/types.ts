/**
 * lib/club-directory/types.ts
 *
 * CLUB-DIRECTORY-01 — shared DTO and input types for the canonical external
 * club/team directory. Kept provider-agnostic: "SFV" is just a string value
 * of `provider`, never hard-coded into a type.
 */

import type { ExternalTeamCompetitionContext } from "./competition-context";
import type { LogoContrastMode } from "./logo-contrast-mode";

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
  /** CLUB-DIRECTORY-04 — real provider-reported league/competition name. */
  providerLeagueName: string | null;
  /** CLUB-DIRECTORY-04 — real provider-reported competition group name. */
  providerGroupName: string | null;
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
  logoContrastMode: LogoContrastMode;
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
  /**
   * CLUB-DIRECTORY-04 — real sporting context (league/competition,
   * competition group) resolved from `providerMappings`, for display next
   * to the canonical team name when multiple ExternalTeams share the same
   * name. Never includes a provider Team-ID; all-null when the provider
   * has not reported any usable context for this team yet — see
   * lib/club-directory/competition-context.ts.
   */
  competitionContext: ExternalTeamCompetitionContext;
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

/**
 * CLUB-DIRECTORY-02C — lookup input for resolving the canonical ExternalClub
 * by its provider CLUB identity (SFV: clubNumber), as opposed to
 * `ProviderIdentityLookupInput` above which resolves by provider TEAM id.
 */
export type ProviderClubIdentityLookupInput = {
  tenantId: string;
  provider: string;
  providerClubId: number;
};

/**
 * CLUB-DIRECTORY-02C — logo-completeness lookup result: the canonical
 * club's current logo state plus every distinct provider teamId already
 * linked under it (across all of its ExternalTeams), so a logo-enrichment
 * attempt can try additional linked team IDs when the first one yields no
 * crest (see lib/integrations/sfv/sync/team-logo.ts).
 */
export type ExternalClubProviderLookupResult = {
  id: string;
  logoUrl: string | null;
  archivedAt: Date | null;
  /** Distinct provider teamIds linked to this club, in ascending order. */
  linkedProviderTeamIds: number[];
};
