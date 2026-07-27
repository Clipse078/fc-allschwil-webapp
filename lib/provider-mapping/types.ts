/**
 * lib/provider-mapping/types.ts
 *
 * Canonical provider-neutral type definitions for the provider team mapping layer.
 *
 * TEAM-PROVIDER-01: Establishes the abstract interface that all provider adapters
 * must implement. SFV is the first adapter; future providers (KNVB, DFB, FFF, …)
 * implement the same interface without changes to canonical services.
 *
 * Architecture invariants:
 *   - No provider-specific logic in this file.
 *   - All provider operations are tenant-scoped.
 *   - Confidence scoring is the sole responsibility of the suggestion engine.
 */

// ── Mapping source ──────────────────────────────────────────────────────────

/**
 * How a TeamExternalMapping was created.
 *   SYNC   — created automatically by a provider sync run.
 *   MANUAL — created explicitly by an administrator through the mapping workflow.
 */
export type MappingSource = "SYNC" | "MANUAL";

/**
 * Suggestion-engine confidence level assigned at mapping creation time.
 *   HIGH   — strong signals: competition match + name similarity.
 *   MEDIUM — moderate signals: some overlap.
 *   LOW    — weak signals: only secondary matches.
 */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// ── Provider team ───────────────────────────────────────────────────────────

/**
 * A team record returned by a provider adapter.
 * Normalised representation — no provider-specific fields.
 */
export type ProviderTeam = {
  /** Provider-assigned team identifier (integer). */
  externalTeamId: number;
  /** Provider-assigned season identifier (integer). */
  externalSeasonId: number;
  /** Display name as reported by the provider. */
  name: string;
  /** Provider-reported league identifier. Null when not applicable. */
  leagueId: number | null;
  /** Provider-reported league name. Null when not applicable. */
  leagueName: string | null;
  /** Provider-reported organisation identifier. Null when not applicable. */
  organisationId: number | null;
  /** Provider-reported age category label. Null when not available. */
  ageCategory: string | null;
  /** Provider-reported gender label. Null when not available. */
  gender: string | null;
  /** Whether the provider reports this team as currently active. */
  isActive: boolean;
};

// ── Provider adapter interface ──────────────────────────────────────────────

/**
 * Input for fetching provider teams.
 * All fields are optional — the adapter decides which are relevant.
 */
export type FetchProviderTeamsInput = {
  tenantId: string;
  /** Narrow results to teams that participate in this competition's league. */
  competitionId?: string;
};

/**
 * Provider adapter interface.
 *
 * All provider adapters must implement this interface. The canonical services
 * call this interface exclusively — no provider-specific code outside adapters.
 *
 * Each adapter is registered under a provider key (e.g. "SFV").
 * The registry resolves adapters by provider key at runtime.
 */
export interface IProviderAdapter {
  /** Provider identifier key (e.g. "SFV"). Must be unique in the registry. */
  readonly providerKey: string;

  /**
   * Returns all provider teams available for this tenant.
   *
   * Used to list unmapped provider teams and to power the suggestion engine.
   * The adapter may filter by competition context when competitionId is provided.
   *
   * @throws if tenant configuration is missing or the provider API is unavailable.
   */
  fetchProviderTeams(input: FetchProviderTeamsInput): Promise<ProviderTeam[]>;

  /**
   * Returns the provider's season identifier relevant for this tenant.
   * Used when building TeamExternalMapping rows.
   *
   * @throws if tenant configuration is missing.
   */
  getProviderSeasonId(tenantId: string): Promise<number>;
}

// ── Mapping DTO ──────────────────────────────────────────────────────────────

/**
 * Canonical representation of a provider mapping row.
 * Safe to return from API routes — no Prisma types, no DB-internal fields.
 */
export type ProviderMappingDto = {
  id: string;
  tenantId: string;
  teamId: string;
  teamName: string;
  teamSeasonId: string | null;
  teamSeasonDisplayName: string | null;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerLeagueId: number | null;
  providerLeagueName: string | null;
  providerOrganisationId: number | null;
  providerIsActive: boolean;
  mappingSource: MappingSource;
  confidenceLevel: ConfidenceLevel | null;
  mappingCompetitionId: string | null;
  mappingCompetitionName: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

// ── Suggestion DTO ──────────────────────────────────────────────────────────

/**
 * A single mapping suggestion produced by the suggestion engine.
 */
export type MappingSuggestion = {
  providerTeam: ProviderTeam;
  /** Normalised 0–100 confidence score. */
  score: number;
  confidenceLevel: ConfidenceLevel;
  /** Human-readable explanation of the top scoring signals. */
  reasons: string[];
};

// ── Service input/result types ──────────────────────────────────────────────

export type CreateProviderMappingInput = {
  tenantId: string;
  teamSeasonId: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  /** Competition ID used as context for this mapping (informational). */
  competitionId?: string;
  /** Confidence level if coming from suggestion engine. */
  confidenceLevel?: ConfidenceLevel;
};

export type CreateProviderMappingResult =
  | { ok: true; mapping: ProviderMappingDto }
  | { ok: false; code: CreateProviderMappingErrorCode; message: string };

export type CreateProviderMappingErrorCode =
  | "TEAM_SEASON_NOT_FOUND"
  | "TEAM_SEASON_ARCHIVED"
  | "TEAM_SEASON_TENANT_MISMATCH"
  | "COMPETITION_NOT_FOUND"
  | "COMPETITION_ARCHIVED"
  | "COMPETITION_TENANT_MISMATCH"
  | "PROVIDER_NOT_FOUND"
  | "ALREADY_MAPPED"
  | "EXTERNAL_TEAM_ALREADY_MAPPED"
  | "UNKNOWN_ERROR";

export type RemoveProviderMappingResult =
  | { ok: true }
  | { ok: false; code: "MAPPING_NOT_FOUND" | "UNKNOWN_ERROR"; message: string };

export type ValidateProviderMappingResult = {
  valid: boolean;
  errors: string[];
};
