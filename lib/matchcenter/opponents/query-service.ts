export const OPPONENT_DEFAULT_LIMIT = 50;
export const OPPONENT_MAX_LIMIT = 200;

// ── Private record types ───────────────────────────────────────────────────────

interface OpponentExternalMappingRecord {
  id: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerOrganisationId: number | null;
  providerLogoUrl: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date | null;
}

interface OpponentRecord {
  id: string;
  tenantId: string;
  officialName: string;
  shortName: string | null;
  websiteName: string | null;
  infoboardName: string | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  externalMappings: OpponentExternalMappingRecord[];
}

interface OpponentDelegate {
  findMany(args: object): Promise<OpponentRecord[]>;
  findFirst(args: object): Promise<OpponentRecord | null>;
}

// ── Public database interface ──────────────────────────────────────────────────

export interface OpponentQueryDatabase {
  opponent: OpponentDelegate;
}

// ── Public input interfaces ────────────────────────────────────────────────────

export interface OpponentListInput {
  tenantId: string;
  /** Case-insensitive substring match against officialName and shortName. */
  search?: string;
  /** Restrict to opponents that have at least one mapping for this provider. */
  provider?: string;
  /** Number of records to return (1–OPPONENT_MAX_LIMIT). Defaults to OPPONENT_DEFAULT_LIMIT. */
  limit?: number;
  /** Number of records to skip. Must be a non-negative integer. Defaults to 0. */
  skip?: number;
  /** When true, archived opponents are included. Defaults to false. */
  includeArchived?: boolean;
}

export interface OpponentDetailInput {
  tenantId: string;
  id: string;
}

// ── Public DTO interfaces ──────────────────────────────────────────────────────

export interface OpponentExternalMappingDto {
  id: string;
  provider: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerTeamName: string | null;
  providerOrganisationId: number | null;
  providerLogoUrl: string | null;
  providerIsActive: boolean;
  lastSyncedAt: Date | null;
}

export interface OpponentDto {
  id: string;
  tenantId: string;
  officialName: string;
  shortName: string | null;
  websiteName: string | null;
  infoboardName: string | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  externalMappings: OpponentExternalMappingDto[];
}

// ── Relations ──────────────────────────────────────────────────────────────────

const opponentRelations = {
  externalMappings: true,
} as const;

// ── Private helpers ────────────────────────────────────────────────────────────

function requireIdentifier(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function resolveListOptions(input: OpponentListInput): {
  limit: number;
  skip: number;
  search: string | null;
  provider: string | null;
  includeArchived: boolean;
} {
  const limit = input.limit ?? OPPONENT_DEFAULT_LIMIT;
  const skip = input.skip ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > OPPONENT_MAX_LIMIT) {
    throw new Error(
      `Opponent limit must be between 1 and ${OPPONENT_MAX_LIMIT}.`,
    );
  }

  if (!Number.isInteger(skip) || skip < 0) {
    throw new Error(
      "Opponent skip must be a non-negative integer.",
    );
  }

  const trimmedSearch = input.search?.trim() ?? "";
  const search = trimmedSearch.length > 0 ? trimmedSearch : null;

  const trimmedProvider = input.provider?.trim() ?? "";
  const provider =
    trimmedProvider.length > 0 ? trimmedProvider.toUpperCase() : null;

  return {
    limit,
    skip,
    search,
    provider,
    includeArchived: input.includeArchived ?? false,
  };
}

function buildWhere(
  tenantId: string,
  options: {
    search: string | null;
    provider: string | null;
    includeArchived: boolean;
  },
) {
  return {
    tenantId,
    ...(options.includeArchived ? {} : { archivedAt: null }),
    ...(options.search !== null
      ? {
          OR: [
            {
              officialName: {
                contains: options.search,
                mode: "insensitive" as const,
              },
            },
            {
              shortName: {
                contains: options.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(options.provider !== null
      ? { externalMappings: { some: { provider: options.provider } } }
      : {}),
  };
}

function toMappingDto(
  record: OpponentExternalMappingRecord,
): OpponentExternalMappingDto {
  return {
    id: record.id,
    provider: record.provider,
    externalTeamId: record.externalTeamId,
    externalSeasonId: record.externalSeasonId,
    providerTeamName: record.providerTeamName,
    providerOrganisationId: record.providerOrganisationId,
    providerLogoUrl: record.providerLogoUrl,
    providerIsActive: record.providerIsActive,
    lastSyncedAt: record.lastSyncedAt,
  };
}

function toOpponentDto(record: OpponentRecord): OpponentDto {
  return {
    id: record.id,
    tenantId: record.tenantId,
    officialName: record.officialName,
    shortName: record.shortName,
    websiteName: record.websiteName,
    infoboardName: record.infoboardName,
    notes: record.notes,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    externalMappings: record.externalMappings.map(toMappingDto),
  };
}

// ── Public service functions ───────────────────────────────────────────────────

export async function listOpponents(
  database: OpponentQueryDatabase,
  input: OpponentListInput,
): Promise<OpponentDto[]> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const options = resolveListOptions(input);

  const records = await database.opponent.findMany({
    where: buildWhere(tenantId, options),
    include: opponentRelations,
    orderBy: [
      { officialName: "asc" },
      { id: "asc" },
    ],
    take: options.limit,
    skip: options.skip,
  });

  return records.map(toOpponentDto);
}

export async function getOpponentById(
  database: OpponentQueryDatabase,
  input: OpponentDetailInput,
): Promise<OpponentDto | null> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");

  const record = await database.opponent.findFirst({
    where: {
      id,
      tenantId,
    },
    include: opponentRelations,
  });

  return record === null ? null : toOpponentDto(record);
}
