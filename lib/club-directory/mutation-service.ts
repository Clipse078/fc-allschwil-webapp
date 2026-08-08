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
    /**
     * CLUB-DIRECTORY-03 — used by `mergeExternalClubs` to enumerate every
     * ExternalTeam currently parented under a losing club (active *and*
     * archived — a merge never leaves a team behind just because it was
     * already archived) before re-parenting each one onto the surviving
     * club.
     */
    findMany(args: object): Promise<ExternalTeamRow[]>;
    create(args: object): Promise<ExternalTeamRow>;
    update(args: object): Promise<ExternalTeamRow>;
  };
  externalClubProviderMapping: {
    findFirst(args: object): Promise<ExternalClubProviderMappingRow | null>;
    /**
     * CLUB-DIRECTORY-03 — used by `mergeExternalClubs` to enumerate every
     * provider mapping still pointing at a losing club before re-pointing
     * each one (by primary key, via `update` below) onto the surviving
     * club. Never used to *discover* merge candidates — merges are always
     * explicit, never inferred from shared provider identity.
     */
    findMany(args: object): Promise<ExternalClubProviderMappingRow[]>;
    upsert(args: object): Promise<ExternalClubProviderMappingRow>;
    /**
     * CLUB-DIRECTORY-03 — re-points a single provider mapping's
     * `externalClubId` (by primary key) onto the surviving club during a
     * manual merge. Distinct from `upsert` above: this never creates a
     * row and never touches the (tenantId, provider, providerClubId)
     * identity itself, only which ExternalClub it currently belongs to —
     * so multiple mappings can safely be re-pointed onto the same
     * surviving club without ever colliding on that unique constraint.
     */
    update(args: object): Promise<ExternalClubProviderMappingRow>;
    /**
     * CLUB-DIRECTORY-02C — a plain (non-upsert) create used exclusively to
     * atomically *claim* a provider CLUB identity inside `transaction()`
     * below, mirroring the CLUB-DIRECTORY-02 team-identity race fix one
     * level up. Implementations MUST reject a duplicate (tenantId,
     * provider, providerClubId) by throwing
     * `ClubDirectoryUniqueConstraintError` — never by silently updating the
     * existing row (that is what `upsert` is for) — so a losing concurrent
     * caller (e.g. two overlapping syncs both discovering a brand-new SFV
     * club for the first time via two different teams) can detect the
     * conflict and roll back its own transaction, then adopt the winner's
     * canonical ExternalClub instead of creating a duplicate.
     */
    create(args: object): Promise<ExternalClubProviderMappingRow>;
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

// ── ExternalTeam: move / reassign to another canonical club ────────────────────

export type MoveExternalTeamInput = {
  tenantId: string;
  /** The ExternalTeam to reassign. */
  id: string;
  /** The canonical ExternalClub the team should move to. */
  targetExternalClubId: string;
};

/**
 * Re-parents an ExternalTeam onto a different (canonical) ExternalClub.
 *
 * Used by the Club Directory UI to correct mis-discovered team/club splits
 * — e.g. "BSC Old Boys B1" and "BSC Old Boys C1" originally surfaced as
 * their own ExternalClub shells and need moving under the real "BSC Old
 * Boys" canonical club.
 *
 * Provider identity is untouched: ExternalTeamProviderMapping rows key off
 * `externalTeamId`, which never changes here, so every provider mapping
 * for this team stays linked exactly as before — only the team's parent
 * club changes.
 *
 * Both the team and the target club must belong to the same tenant
 * (tenant isolation — enforced by `requireExternalTeam`/`requireExternalClub`
 * scoping every lookup to `tenantId`). Moving into an archived club is
 * rejected, mirroring `createExternalTeam`'s same rule for newly created
 * teams.
 */
export async function moveExternalTeamToClub(
  database: ClubDirectoryMutationDatabase,
  input: MoveExternalTeamInput,
): Promise<ExternalTeamRow> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const id = requireIdentifier(input.id, "id");
  const targetExternalClubId = requireIdentifier(
    input.targetExternalClubId,
    "targetExternalClubId",
  );

  const team = await requireExternalTeam(database, tenantId, id);

  if (team.externalClubId === targetExternalClubId) {
    return team;
  }

  const targetClub = await requireExternalClub(database, tenantId, targetExternalClubId);
  if (targetClub.archivedAt !== null) {
    throw new ClubDirectoryValidationError(
      "Cannot move an ExternalTeam to an archived ExternalClub.",
    );
  }

  return database.externalTeam.update({
    where: { id },
    data: { externalClubId: targetExternalClubId },
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

// ── Manual club merge ───────────────────────────────────────────────────────────
//
// CLUB-DIRECTORY-03 — merges one or more duplicate ExternalClub records
// ("losing" clubs, explicitly chosen by a tenant admin) into a single
// "surviving" canonical ExternalClub. This is ALWAYS an explicit, one-shot
// admin action — never inferred from names or run as a background sweep
// (see lib/club-directory/consolidation-service.ts for the separate,
// provider-identity-driven backfill this deliberately does NOT duplicate).
//
// Safety invariants (mirrors consolidation-service.ts's proven rules):
//   - NEVER deletes anything. Losing clubs are archived (`archivedAt` set),
//     never removed — reversible via the existing restore endpoint.
//   - NEVER loses a team: every ExternalTeam under a losing club (active or
//     archived) is re-parented onto the surviving club.
//   - NEVER loses a provider mapping: every ExternalClubProviderMapping row
//     under a losing club is re-pointed (by primary key) onto the surviving
//     club. The unique identity constraint is (tenantId, provider,
//     providerClubId) — it does not include externalClubId — so re-pointing
//     several mappings onto the same surviving club can never collide.
//   - NEVER merges across tenants or merges a club into itself: every club
//     (surviving + losing) is resolved through `requireExternalClub`, which
//     scopes the lookup to `tenantId` and 404s on any cross-tenant id, and
//     self-merge is rejected explicitly before any write.
// ─────────────────────────────────────────────────────────────────────────────

export type MergeExternalClubsInput = {
  tenantId: string;
  /** The canonical ExternalClub that survives the merge. */
  survivingClubId: string;
  /** One or more ExternalClub ids to merge into the surviving club. */
  losingClubIds: string[];
};

export type MergeExternalClubsResult = {
  survivingClubId: string;
  /** Losing ExternalClub ids that were archived (never deleted) by this merge. */
  mergedClubIds: string[];
  /** Total ExternalTeam rows re-parented onto the surviving club. */
  teamsMoved: number;
  /** Total ExternalClubProviderMapping rows re-pointed onto the surviving club. */
  providerMappingsMoved: number;
  /** The losing ExternalClub a logo was adopted from, or null. */
  logoAdoptedFromClubId: string | null;
};

/**
 * Adopts a logo onto the surviving club ONLY when it currently has none —
 * mirrors provider-sync.ts's `buildExternalClubTenantFieldUpdate` /
 * consolidation-service.ts's `chooseLogoDonor`: an existing tenant-managed
 * (or previously adopted) logo is never overwritten by a merge.
 */
async function adoptLogoDuringMerge(
  database: ClubDirectoryMutationDatabase,
  survivingClub: ExternalClubRow,
  losingClubs: readonly ExternalClubRow[],
): Promise<string | null> {
  if (survivingClub.logoUrl !== null && survivingClub.logoUrl.trim() !== "") {
    return null;
  }

  const donor = [...losingClubs]
    .filter((c) => c.logoUrl !== null && c.logoUrl.trim() !== "")
    .sort((a, b) => a.id.localeCompare(b.id))[0];

  if (donor === undefined) return null;

  await database.externalClub.update({
    where: { id: survivingClub.id },
    data: { logoUrl: donor.logoUrl },
  });

  return donor.id;
}

/**
 * Merges one or more explicitly-chosen "losing" ExternalClub records into a
 * single "surviving" canonical ExternalClub.
 *
 * Every team and provider mapping under a losing club is moved onto the
 * surviving club, a logo is adopted from a losing club when the survivor
 * has none, and every losing club is archived (never deleted) — all inside
 * one transaction so a mid-merge failure never leaves teams or mappings
 * split across a half-migrated state.
 */
export async function mergeExternalClubs(
  database: ClubDirectoryMutationDatabase,
  input: MergeExternalClubsInput,
  now: Date = new Date(),
): Promise<MergeExternalClubsResult> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const survivingClubId = requireIdentifier(input.survivingClubId, "survivingClubId");

  const rawLosingIds = Array.isArray(input.losingClubIds) ? input.losingClubIds : [];
  const losingClubIds = [...new Set(rawLosingIds.map((id) => requireIdentifier(id, "losingClubIds")))];

  if (losingClubIds.length === 0) {
    throw new ClubDirectoryValidationError("At least one losing club is required to merge.");
  }
  if (losingClubIds.includes(survivingClubId)) {
    throw new ClubDirectoryValidationError("Cannot merge a club into itself.");
  }

  // Resolving every club through requireExternalClub — tenant-scoped —
  // before any write means a missing or cross-tenant id fails the whole
  // merge up front; nothing is ever partially applied.
  const survivingClub = await requireExternalClub(database, tenantId, survivingClubId);
  const losingClubs: ExternalClubRow[] = [];
  for (const losingClubId of losingClubIds) {
    losingClubs.push(await requireExternalClub(database, tenantId, losingClubId));
  }

  return database.transaction(async (tx) => {
    let teamsMoved = 0;
    let providerMappingsMoved = 0;

    for (const losingClub of losingClubs) {
      const teams = await tx.externalTeam.findMany({
        where: { tenantId, externalClubId: losingClub.id },
      });
      for (const team of teams) {
        await tx.externalTeam.update({
          where: { id: team.id },
          data: { externalClubId: survivingClubId },
        });
        teamsMoved++;
      }

      const mappings = await tx.externalClubProviderMapping.findMany({
        where: { tenantId, externalClubId: losingClub.id },
      });
      for (const mapping of mappings) {
        await tx.externalClubProviderMapping.update({
          where: { id: mapping.id },
          data: { externalClubId: survivingClubId },
        });
        providerMappingsMoved++;
      }
    }

    const logoAdoptedFromClubId = await adoptLogoDuringMerge(tx, survivingClub, losingClubs);

    for (const losingClubId of losingClubIds) {
      await tx.externalClub.update({
        where: { id: losingClubId },
        data: { archivedAt: now },
      });
    }

    return {
      survivingClubId,
      mergedClubIds: losingClubIds,
      teamsMoved,
      providerMappingsMoved,
      logoAdoptedFromClubId,
    };
  });
}
