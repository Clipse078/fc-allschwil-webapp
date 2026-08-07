/**
 * lib/club-directory/mutation-service.ts
 *
 * CLUB-DIRECTORY-01 — write-side service for the canonical external
 * club/team directory.
 *
 * Design mirrors lib/club-directory/query-service.ts: pure business logic
 * (validation, tenant scoping, field-ownership discipline) operating
 * against an injected database interface, so every rule in the
 * CLUB-DIRECTORY-01 test matrix — manual creation, provider linking,
 * "same name + different provider IDs stay distinct", "provider sync never
 * overwrites tenant enrichment", archive/restore, tenant isolation — is
 * unit-testable without a real Prisma client.
 *
 * Identity rule (never violated by this module):
 *   - Manually-created clubs/teams are identified by their SportClubEvo
 *     cuid. Never merged by name.
 *   - Provider-linked identity is provider + provider-assigned numeric id,
 *     enforced by the @@unique([tenantId, provider, providerClubId]) /
 *     @@unique([tenantId, provider, providerTeamId, providerSeasonId])
 *     constraints on the *ProviderMapping tables, and re-checked here so
 *     callers get a clean domain error instead of a raw constraint violation.
 */

import {
  buildExternalClubMappingUpdate,
  buildExternalClubTenantFieldUpdate,
  buildExternalTeamMappingUpdate,
  type ProviderClubSyncPayload,
  type ProviderTeamSyncPayload,
} from "./provider-sync";

// ── Row shapes (structural — match Prisma's shape) ─────────────────────────────

export type ExternalClubRow = {
  id: string;
  tenantId: string;
  name: string;
  shortName: string | null;
  alternativeName: string | null;
  website: string | null;
  location: string | null;
  logoUrl: string | null;
  notes: string | null;
  source: string;
  archivedAt: Date | null;
};

export type ExternalTeamRow = {
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
};

export type ExternalClubProviderMappingRow = {
  id: string;
  tenantId: string;
  externalClubId: string;
  provider: string;
  providerClubId: number;
};

export type ExternalTeamProviderMappingRow = {
  id: string;
  tenantId: string;
  externalTeamId: string;
  provider: string;
  providerTeamId: number;
  providerSeasonId: number;
};

// ── Database interface ─────────────────────────────────────────────────────────

export interface ClubDirectoryMutationDatabase {
  externalClub: {
    findFirst(args: object): Promise<ExternalClubRow | null>;
    create(args: object): Promise<ExternalClubRow>;
    update(args: object): Promise<ExternalClubRow>;
  };
  externalTeam: {
    findFirst(args: object): Promise<ExternalTeamRow | null>;
    create(args: object): Promise<ExternalTeamRow>;
    update(args: object): Promise<ExternalTeamRow>;
  };
  externalClubProviderMapping: {
    findFirst(args: object): Promise<ExternalClubProviderMappingRow | null>;
    upsert(args: object): Promise<ExternalClubProviderMappingRow>;
  };
  externalTeamProviderMapping: {
    findFirst(args: object): Promise<ExternalTeamProviderMappingRow | null>;
    upsert(args: object): Promise<ExternalTeamProviderMappingRow>;
    /**
     * CLUB-DIRECTORY-02 concurrency fix — a plain (non-upsert) create used
     * exclusively to atomically *claim* a provider identity inside
     * `transaction()` below. Implementations MUST reject a duplicate
     * (tenantId, provider, providerTeamId, providerSeasonId) by throwing
     * `ClubDirectoryUniqueConstraintError` — never by silently updating the
     * existing row (that is what `upsert` is for) — so a losing concurrent
     * caller can detect the conflict and roll back its own transaction.
     */
    create(args: object): Promise<ExternalTeamProviderMappingRow>;
  };
  /**
   * CLUB-DIRECTORY-02 concurrency fix — runs `fn` against a transactional
   * view of this database. Implementations MUST provide real atomicity
   * (e.g. Prisma's interactive `$transaction`): if `fn` throws, every write
   * performed through the transactional database passed to `fn` is rolled
   * back as a single unit. Used by discovery-service.ts to make "create the
   * canonical shell + claim the provider identity" all-or-nothing, so two
   * concurrent discoveries of the same brand-new provider identity can never
   * both leave behind a committed ExternalClub/ExternalTeam pair.
   */
  transaction<T>(fn: (tx: ClubDirectoryMutationDatabase) => Promise<T>): Promise<T>;
}

// ── Domain errors ───────────────────────────────────────────────────────────────

export class ClubDirectoryNotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = "ClubDirectoryNotFoundError";
  }
}

export class ClubDirectoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClubDirectoryValidationError";
  }
}

export class ClubDirectoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClubDirectoryConflictError";
  }
}

/**
 * CLUB-DIRECTORY-02 concurrency fix — thrown by
 * `ClubDirectoryMutationDatabase.externalTeamProviderMapping.create()` when
 * a row already exists for the same (tenantId, provider, providerTeamId,
 * providerSeasonId). Distinct from `ClubDirectoryConflictError` (which
 * signals a genuine identity conflict — the same provider id already
 * pointing at a *different* canonical record chosen by a caller) — this
 * error instead signals a benign concurrency race that the caller
 * (discovery-service.ts) recovers from transparently by adopting whichever
 * row won the race.
 */
export class ClubDirectoryUniqueConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClubDirectoryUniqueConstraintError";
  }
}

// ── Shared helpers ──────────────────────────────────────────────────────────────

function requireIdentifier(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) {
    throw new ClubDirectoryValidationError(`${fieldName} is required.`);
  }
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ClubDirectoryValidationError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

// ── ExternalClub: manual creation / edit ────────────────────────────────────────

export type CreateExternalClubInput = {
  tenantId: string;
  name: string;
  shortName?: string | null;
  alternativeName?: string | null;
  website?: string | null;
  location?: string | null;
  notes?: string | null;
};

export async function createExternalClub(
  database: ClubDirectoryMutationDatabase,
  input: CreateExternalClubInput,
): Promise<ExternalClubRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const name = requireIdentifier(input.name, "name");

  return database.externalClub.create({
    data: {
      tenantId,
      name,
      shortName: normalizeOptionalString(input.shortName),
      alternativeName: normalizeOptionalString(input.alternativeName),
      website: normalizeOptionalString(input.website),
      location: normalizeOptionalString(input.location),
      notes: normalizeOptionalString(input.notes),
      // Manual creation is the only path that reaches this function — provider
      // sync never calls createExternalClub (see linkExternalClubProvider,
      // which links a provider identity to an already-existing, possibly
      // manually-created, ExternalClub — no auto-merge by name, ever).
      source: "MANUAL",
    },
  });
}

export type UpdateExternalClubInput = {
  tenantId: string;
  id: string;
  name?: string;
  shortName?: string | null;
  alternativeName?: string | null;
  website?: string | null;
  location?: string | null;
  notes?: string | null;
  logoUrl?: string | null;
};

async function requireExternalClub(
  database: ClubDirectoryMutationDatabase,
  tenantId: string,
  id: string,
): Promise<ExternalClubRow> {
  const club = await database.externalClub.findFirst({ where: { id, tenantId } });
  if (club === null) {
    throw new ClubDirectoryNotFoundError("ExternalClub");
  }
  return club;
}

export async function updateExternalClub(
  database: ClubDirectoryMutationDatabase,
  input: UpdateExternalClubInput,
): Promise<ExternalClubRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");
  await requireExternalClub(database, tenantId, id);

  if (input.name !== undefined) {
    requireIdentifier(input.name, "name");
  }

  return database.externalClub.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.shortName !== undefined
        ? { shortName: normalizeOptionalString(input.shortName) }
        : {}),
      ...(input.alternativeName !== undefined
        ? { alternativeName: normalizeOptionalString(input.alternativeName) }
        : {}),
      ...(input.website !== undefined ? { website: normalizeOptionalString(input.website) } : {}),
      ...(input.location !== undefined
        ? { location: normalizeOptionalString(input.location) }
        : {}),
      ...(input.notes !== undefined ? { notes: normalizeOptionalString(input.notes) } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: normalizeOptionalString(input.logoUrl) } : {}),
    },
  });
}

export type SetExternalClubArchivedInput = {
  tenantId: string;
  id: string;
  archived: boolean;
};

export async function setExternalClubArchived(
  database: ClubDirectoryMutationDatabase,
  input: SetExternalClubArchivedInput,
): Promise<ExternalClubRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");
  await requireExternalClub(database, tenantId, id);

  return database.externalClub.update({
    where: { id },
    data: { archivedAt: input.archived ? new Date() : null },
  });
}

// ── ExternalTeam: manual creation / edit ────────────────────────────────────────

export type CreateExternalTeamInput = {
  tenantId: string;
  externalClubId: string;
  name: string;
  shortName?: string | null;
  alternativeName?: string | null;
  categoryLabel?: string | null;
};

export async function createExternalTeam(
  database: ClubDirectoryMutationDatabase,
  input: CreateExternalTeamInput,
): Promise<ExternalTeamRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const externalClubId = requireIdentifier(input.externalClubId, "externalClubId");
  const name = requireIdentifier(input.name, "name");

  const club = await requireExternalClub(database, tenantId, externalClubId);
  if (club.archivedAt !== null) {
    throw new ClubDirectoryValidationError(
      "Cannot create an ExternalTeam under an archived ExternalClub.",
    );
  }

  return database.externalTeam.create({
    data: {
      tenantId,
      externalClubId,
      name,
      shortName: normalizeOptionalString(input.shortName),
      alternativeName: normalizeOptionalString(input.alternativeName),
      categoryLabel: normalizeOptionalString(input.categoryLabel),
      source: "MANUAL",
    },
  });
}

export type UpdateExternalTeamInput = {
  tenantId: string;
  id: string;
  name?: string;
  shortName?: string | null;
  alternativeName?: string | null;
  categoryLabel?: string | null;
  logoUrl?: string | null;
};

async function requireExternalTeam(
  database: ClubDirectoryMutationDatabase,
  tenantId: string,
  id: string,
): Promise<ExternalTeamRow> {
  const team = await database.externalTeam.findFirst({ where: { id, tenantId } });
  if (team === null) {
    throw new ClubDirectoryNotFoundError("ExternalTeam");
  }
  return team;
}

export async function updateExternalTeam(
  database: ClubDirectoryMutationDatabase,
  input: UpdateExternalTeamInput,
): Promise<ExternalTeamRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");
  await requireExternalTeam(database, tenantId, id);

  if (input.name !== undefined) {
    requireIdentifier(input.name, "name");
  }

  return database.externalTeam.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.shortName !== undefined
        ? { shortName: normalizeOptionalString(input.shortName) }
        : {}),
      ...(input.alternativeName !== undefined
        ? { alternativeName: normalizeOptionalString(input.alternativeName) }
        : {}),
      ...(input.categoryLabel !== undefined
        ? { categoryLabel: normalizeOptionalString(input.categoryLabel) }
        : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: normalizeOptionalString(input.logoUrl) } : {}),
    },
  });
}

export type SetExternalTeamArchivedInput = {
  tenantId: string;
  id: string;
  archived: boolean;
};

export async function setExternalTeamArchived(
  database: ClubDirectoryMutationDatabase,
  input: SetExternalTeamArchivedInput,
): Promise<ExternalTeamRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");
  await requireExternalTeam(database, tenantId, id);

  return database.externalTeam.update({
    where: { id },
    data: { archivedAt: input.archived ? new Date() : null },
  });
}

// ── Provider linking (manual record → provider identity) ───────────────────────

export type LinkExternalClubProviderInput = {
  tenantId: string;
  externalClubId: string;
  provider: string;
  providerClubId: number;
} & ProviderClubSyncPayload;

/**
 * Links (or re-syncs) a provider identity to an ExternalClub.
 *
 * Idempotent: calling this again with the same (tenantId, provider,
 * providerClubId) refreshes only the provider-owned mapping fields
 * (test #7 — "provider sync does not overwrite tenant enrichment") and,
 * when the club has no tenant-managed logo yet, fills it from
 * providerLogoUrl (test #8 — "logo persistence/fallback").
 *
 * Rejects linking a provider identity that is already attached to a
 * *different* ExternalClub in the same tenant (identity integrity — the
 * same provider club id must never resolve to two canonical clubs).
 */
export async function linkExternalClubProvider(
  database: ClubDirectoryMutationDatabase,
  input: LinkExternalClubProviderInput,
  now: Date = new Date(),
): Promise<{ mapping: ExternalClubProviderMappingRow; club: ExternalClubRow }> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const externalClubId = requireIdentifier(input.externalClubId, "externalClubId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();
  const providerClubId = requirePositiveInteger(input.providerClubId, "providerClubId");

  const club = await requireExternalClub(database, tenantId, externalClubId);

  const existingMapping = await database.externalClubProviderMapping.findFirst({
    where: { tenantId, provider, providerClubId },
  });

  if (existingMapping !== null && existingMapping.externalClubId !== externalClubId) {
    throw new ClubDirectoryConflictError(
      `Provider identity ${provider}:${providerClubId} is already linked to a different ExternalClub.`,
    );
  }

  const mappingUpdate = buildExternalClubMappingUpdate(input, now);

  const mapping = await database.externalClubProviderMapping.upsert({
    where: { tenantId_provider_providerClubId: { tenantId, provider, providerClubId } },
    create: { tenantId, externalClubId, provider, providerClubId, ...mappingUpdate },
    update: mappingUpdate,
  });

  const tenantFieldUpdate = buildExternalClubTenantFieldUpdate(
    club.logoUrl,
    mappingUpdate.providerLogoUrl,
  );

  const updatedClub =
    Object.keys(tenantFieldUpdate).length > 0
      ? await database.externalClub.update({ where: { id: externalClubId }, data: tenantFieldUpdate })
      : club;

  return { mapping, club: updatedClub };
}

export type LinkExternalTeamProviderInput = {
  tenantId: string;
  externalTeamId: string;
  provider: string;
  providerTeamId: number;
  providerSeasonId?: number;
} & ProviderTeamSyncPayload;

/**
 * Links (or re-syncs) a provider identity to an ExternalTeam.
 *
 * Also feeds the resolved crest into the *parent* ExternalClub's logoUrl
 * when the club has no tenant-managed logo yet — SFV evidence shows the
 * "team picture" is actually the club crest (see lib/club-directory/logo.ts),
 * so a team-level provider sync is a legitimate club-level logo source.
 */
export async function linkExternalTeamProvider(
  database: ClubDirectoryMutationDatabase,
  input: LinkExternalTeamProviderInput,
  now: Date = new Date(),
): Promise<{ mapping: ExternalTeamProviderMappingRow; team: ExternalTeamRow }> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const externalTeamId = requireIdentifier(input.externalTeamId, "externalTeamId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();
  const providerTeamId = requirePositiveInteger(input.providerTeamId, "providerTeamId");
  const providerSeasonId = input.providerSeasonId ?? 0;

  const team = await requireExternalTeam(database, tenantId, externalTeamId);

  const existingMapping = await database.externalTeamProviderMapping.findFirst({
    where: { tenantId, provider, providerTeamId, providerSeasonId },
  });

  if (existingMapping !== null && existingMapping.externalTeamId !== externalTeamId) {
    throw new ClubDirectoryConflictError(
      `Provider identity ${provider}:${providerTeamId} (season ${providerSeasonId}) is already linked to a different ExternalTeam.`,
    );
  }

  const mappingUpdate = buildExternalTeamMappingUpdate(input, now);

  const mapping = await database.externalTeamProviderMapping.upsert({
    where: {
      tenantId_provider_providerTeamId_providerSeasonId: {
        tenantId,
        provider,
        providerTeamId,
        providerSeasonId,
      },
    },
    create: {
      tenantId,
      externalTeamId,
      provider,
      providerTeamId,
      providerSeasonId,
      ...mappingUpdate,
    },
    update: mappingUpdate,
  });

  if (mappingUpdate.providerLogoUrl !== null) {
    const club = await requireExternalClub(database, tenantId, team.externalClubId);
    const tenantFieldUpdate = buildExternalClubTenantFieldUpdate(
      club.logoUrl,
      mappingUpdate.providerLogoUrl,
    );
    if (Object.keys(tenantFieldUpdate).length > 0) {
      await database.externalClub.update({
        where: { id: club.id },
        data: tenantFieldUpdate,
      });
    }
  }

  return { mapping, team };
}
