/**
 * lib/club-directory/query-service.ts
 *
 * CLUB-DIRECTORY-01 — read-side service for the canonical external
 * club/team directory. Pure functions operating against an injected
 * database interface (mirrors the pattern used by
 * lib/matchcenter/opponents/query-service.ts before it) so that business
 * rules (validation, filtering, DTO shaping) are unit-testable without a
 * real Prisma client.
 */

import type {
  ExternalClubDetailDto,
  ExternalClubDetailInput,
  ExternalClubListInput,
  ExternalClubProviderLookupResult,
  ExternalClubProviderMappingDto,
  ExternalClubSummaryDto,
  ExternalTeamDetailDto,
  ExternalTeamDetailInput,
  ExternalTeamListInput,
  ExternalTeamProviderMappingDto,
  ExternalTeamSummaryDto,
  ProviderClubIdentityLookupInput,
  ProviderIdentityLookupInput,
} from "./types";

export const CLUB_DIRECTORY_DEFAULT_LIMIT = 50;
export const CLUB_DIRECTORY_MAX_LIMIT = 200;

// ── Private record types (structural — match Prisma's shape) ──────────────────

interface ExternalClubProviderMappingRecord {
  id: string;
  provider: string;
  providerClubId: number;
  providerClubName: string | null;
  providerLogoUrl: string | null;
  providerWebsite: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date | null;
}

interface ExternalTeamProviderMappingRecord {
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
}

interface ExternalClubListRecord {
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
  _count: { externalTeams: number; providerMappings: number };
}

interface ExternalTeamListRecord {
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
  providerMappings: ExternalTeamProviderMappingRecord[];
}

interface ExternalClubDetailRecord extends ExternalClubListRecord {
  website: string | null;
  location: string | null;
  notes: string | null;
  providerMappings: ExternalClubProviderMappingRecord[];
  externalTeams: ExternalTeamListRecord[];
}

interface ExternalTeamDetailRecord extends ExternalTeamListRecord {
  externalClub: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
    archivedAt: Date | null;
  };
}

// ── Delegates ───────────────────────────────────────────────────────────────────

interface ExternalClubDelegate {
  findMany(args: object): Promise<ExternalClubListRecord[]>;
  findFirst(args: object): Promise<ExternalClubDetailRecord | null>;
}

interface ExternalTeamDelegate {
  findMany(args: object): Promise<ExternalTeamListRecord[]>;
  findFirst(args: object): Promise<ExternalTeamDetailRecord | null>;
}

export interface ClubDirectoryQueryDatabase {
  externalClub: ExternalClubDelegate;
  externalTeam: ExternalTeamDelegate;
}

// ── Private helpers ────────────────────────────────────────────────────────────

function requireIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function resolveListOptions(input: {
  limit?: number;
  skip?: number;
  search?: string;
  includeArchived?: boolean;
}): {
  limit: number;
  skip: number;
  search: string | null;
  includeArchived: boolean;
} {
  const limit = input.limit ?? CLUB_DIRECTORY_DEFAULT_LIMIT;
  const skip = input.skip ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > CLUB_DIRECTORY_MAX_LIMIT) {
    throw new Error(
      `Club directory limit must be between 1 and ${CLUB_DIRECTORY_MAX_LIMIT}.`,
    );
  }

  if (!Number.isInteger(skip) || skip < 0) {
    throw new Error("Club directory skip must be a non-negative integer.");
  }

  const trimmedSearch = input.search?.trim() ?? "";
  const search = trimmedSearch.length > 0 ? trimmedSearch : null;

  return { limit, skip, search, includeArchived: input.includeArchived ?? false };
}

function nameSearchClause(search: string) {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { shortName: { contains: search, mode: "insensitive" as const } },
      { alternativeName: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

function toMappingDto(
  record: ExternalClubProviderMappingRecord,
): ExternalClubProviderMappingDto {
  return {
    id: record.id,
    provider: record.provider,
    providerClubId: record.providerClubId,
    providerClubName: record.providerClubName,
    providerLogoUrl: record.providerLogoUrl,
    providerWebsite: record.providerWebsite,
    providerIsActive: record.providerIsActive,
    lastSyncedAt: record.lastSyncedAt,
  };
}

function toTeamMappingDto(
  record: ExternalTeamProviderMappingRecord,
): ExternalTeamProviderMappingDto {
  return {
    id: record.id,
    provider: record.provider,
    providerTeamId: record.providerTeamId,
    providerSeasonId: record.providerSeasonId,
    providerTeamName: record.providerTeamName,
    providerClubId: record.providerClubId,
    providerOrganisationId: record.providerOrganisationId,
    providerLogoUrl: record.providerLogoUrl,
    providerIsActive: record.providerIsActive,
    lastSyncedAt: record.lastSyncedAt,
  };
}

function toClubSummaryDto(record: ExternalClubListRecord): ExternalClubSummaryDto {
  return {
    id: record.id,
    tenantId: record.tenantId,
    name: record.name,
    shortName: record.shortName,
    alternativeName: record.alternativeName,
    logoUrl: record.logoUrl,
    source: record.source,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    teamCount: record._count.externalTeams,
    hasProviderMapping: record._count.providerMappings > 0,
  };
}

function toTeamSummaryDto(record: ExternalTeamListRecord): ExternalTeamSummaryDto {
  return {
    id: record.id,
    tenantId: record.tenantId,
    externalClubId: record.externalClubId,
    name: record.name,
    shortName: record.shortName,
    alternativeName: record.alternativeName,
    categoryLabel: record.categoryLabel,
    logoUrl: record.logoUrl,
    source: record.source,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    providerMappings: record.providerMappings.map(toTeamMappingDto),
  };
}

function toClubDetailDto(record: ExternalClubDetailRecord): ExternalClubDetailDto {
  return {
    ...toClubSummaryDto(record),
    website: record.website,
    location: record.location,
    notes: record.notes,
    providerMappings: record.providerMappings.map(toMappingDto),
    teams: record.externalTeams.map(toTeamSummaryDto),
  };
}

function toTeamDetailDto(record: ExternalTeamDetailRecord): ExternalTeamDetailDto {
  return {
    ...toTeamSummaryDto(record),
    externalClub: record.externalClub,
  };
}

// ── Public service functions — ExternalClub ────────────────────────────────────

export async function listExternalClubs(
  database: ClubDirectoryQueryDatabase,
  input: ExternalClubListInput,
): Promise<ExternalClubSummaryDto[]> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const options = resolveListOptions(input);

  const records = await database.externalClub.findMany({
    where: {
      tenantId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.search !== null ? nameSearchClause(options.search) : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: options.limit,
    skip: options.skip,
  });

  return records.map(toClubSummaryDto);
}

export async function getExternalClubById(
  database: ClubDirectoryQueryDatabase,
  input: ExternalClubDetailInput,
): Promise<ExternalClubDetailDto | null> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");

  const record = await database.externalClub.findFirst({
    where: { id, tenantId },
  });

  return record === null ? null : toClubDetailDto(record);
}

// ── Public service functions — ExternalTeam ────────────────────────────────────

export async function listExternalTeams(
  database: ClubDirectoryQueryDatabase,
  input: ExternalTeamListInput,
): Promise<ExternalTeamSummaryDto[]> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const options = resolveListOptions(input);
  const externalClubId = input.externalClubId?.trim() || null;

  const records = await database.externalTeam.findMany({
    where: {
      tenantId,
      ...(externalClubId !== null ? { externalClubId } : {}),
      ...(options.includeArchived ? {} : { archivedAt: null }),
      ...(options.search !== null ? nameSearchClause(options.search) : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: options.limit,
    skip: options.skip,
  });

  return records.map(toTeamSummaryDto);
}

export async function getExternalTeamById(
  database: ClubDirectoryQueryDatabase,
  input: ExternalTeamDetailInput,
): Promise<ExternalTeamDetailDto | null> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");

  const record = await database.externalTeam.findFirst({
    where: { id, tenantId },
  });

  return record === null ? null : toTeamDetailDto(record);
}

/**
 * MATCHCENTER / TOURNAMENTCENTER / FRIENDLY-MATCH forward-compatibility hook.
 *
 * Resolves an ExternalTeam (with its ExternalClub) from a provider identity
 * (provider + provider-assigned numeric team id), the same identity shape
 * MatchExternalMapping already stores for match participants
 * (providerHomeTeamId / providerAwayTeamId).
 *
 * Not called by Matchcenter in this slice (see CLUB-DIRECTORY-01 deliverable
 * notes) — provided so Matchcenter, TournamentCenter, and manual
 * friendly-match creation can resolve "provider team id → canonical
 * ExternalTeam/ExternalClub" without duplicating this lookup once they are
 * wired to consume the directory.
 *
 * Returns null when no ExternalTeam has been linked to that provider
 * identity yet — provider-only opponent display must keep working without a
 * canonical directory entry.
 */
export async function findExternalTeamByProviderIdentity(
  database: ClubDirectoryQueryDatabase,
  input: ProviderIdentityLookupInput,
): Promise<ExternalTeamDetailDto | null> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();

  if (!Number.isInteger(input.providerTeamId) || input.providerTeamId <= 0) {
    throw new Error("providerTeamId must be a positive integer.");
  }

  const record = await database.externalTeam.findFirst({
    where: {
      tenantId,
      providerMappings: { some: { provider, providerTeamId: input.providerTeamId } },
    },
  });

  return record === null ? null : toTeamDetailDto(record);
}

/**
 * CLUB-DIRECTORY-02C LOGO COMPLETENESS forward-compatibility hook.
 *
 * Resolves the canonical ExternalClub for a provider CLUB identity (SFV:
 * clubNumber) together with every distinct provider teamId already linked
 * to one of its ExternalTeams — the full candidate set a logo-enrichment
 * attempt may try (see lib/integrations/sfv/sync/team-logo.ts
 * `resolveClubLogoFromCandidateTeamIds`), so that a picture-fetch failure
 * for ONE linked team never means the club stays logo-less if ANOTHER
 * already-linked team can provide the crest.
 *
 * Returns null when no ExternalClub has been linked to that provider club
 * identity yet (brand-new club — nothing to look up).
 */
export async function findExternalClubByProviderClubId(
  database: ClubDirectoryQueryDatabase,
  input: ProviderClubIdentityLookupInput,
): Promise<ExternalClubProviderLookupResult | null> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();

  if (!Number.isInteger(input.providerClubId) || input.providerClubId <= 0) {
    throw new Error("providerClubId must be a positive integer.");
  }

  const record = await database.externalClub.findFirst({
    where: {
      tenantId,
      providerMappings: { some: { provider, providerClubId: input.providerClubId } },
    },
  });

  if (record === null) return null;

  const linkedProviderTeamIds = [
    ...new Set(
      record.externalTeams.flatMap((team) =>
        team.providerMappings
          .filter((mapping) => mapping.provider === provider)
          .map((mapping) => mapping.providerTeamId),
      ),
    ),
  ].sort((a, b) => a - b);

  return {
    id: record.id,
    logoUrl: record.logoUrl,
    archivedAt: record.archivedAt,
    linkedProviderTeamIds,
  };
}
