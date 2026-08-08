/**
 * lib/club-directory/consolidation-service.ts
 *
 * CLUB-DIRECTORY-02C — Canonical Club Consolidation & Logo Completeness.
 *
 * Backfill/consolidation mechanism for PRE-EXISTING duplicate ExternalClub
 * rows (i.e. STAGE data created before this slice, when every discovered
 * opponent team got its own dedicated ExternalClub — see
 * discovery-service.ts's module doc for the forward-looking fix this
 * reconciles retroactively).
 *
 * This module is deliberately provider-agnostic and DB-shape-agnostic: it
 * accepts a pre-resolved `providerTeamId -> providerClubId` map (the exact
 * same identity signal discovery-service.ts now uses going forward — SFV's
 * `clubNumber`, see lib/integrations/sfv/sync/club-identity.ts for how that
 * map is built) and reconciles whatever ExternalClub rows currently exist
 * for the affected teams. It performs NO network calls itself and makes NO
 * provider-specific assumptions — the SFV-specific orchestration (fetching
 * ranking/team-list data to build the map) lives in
 * lib/integrations/sfv/sync/club-consolidation.ts.
 *
 * ─── Safety invariants (per task requirements) ─────────────────────────────────
 *
 *   - NEVER loses an ExternalTeam: every team is either left exactly where
 *     it is, or re-parented (`externalClubId` updated) to the chosen
 *     canonical club. No `delete()` of any kind is ever issued by this
 *     module.
 *   - NEVER deletes an ExternalClub: a "losing" club that ends up with zero
 *     teams after consolidation is ARCHIVED (`archivedAt` set), not
 *     deleted — reversible, and consistent with the soft-delete pattern
 *     already used everywhere else in this codebase (see
 *     ExternalClub.archivedAt's own schema doc comment).
 *   - NEVER deletes a provider mapping: ExternalTeamProviderMapping rows are
 *     never touched at all (their `externalTeamId` FK is stable regardless
 *     of which club that team belongs to). ExternalClubProviderMapping rows
 *     are only ever created or have their `externalClubId` re-pointed to
 *     the canonical club — never deleted.
 *   - PRESERVES Match references implicitly: `MatchExternalMapping.
 *     homeExternalTeamId` / `awayExternalTeamId` reference `ExternalTeam.id`
 *     directly (see prisma/schema.prisma) — a value this module never
 *     changes. Moving a team between clubs is invisible to every existing
 *     Match reference; Matchcenter's club-logo resolution automatically
 *     starts reading the (now-consolidated) canonical club's crest on its
 *     very next read, with zero code changes (see lib/matchcenter/
 *     query-service.ts, unmodified by this slice).
 *   - NEVER merges across tenants: every query is scoped by `tenantId`, and
 *     `providerTeamId`/`providerClubId` uniqueness constraints are
 *     themselves tenant-scoped (`@@unique([tenantId, provider,
 *     providerClubId])`) — two tenants can never be merged into the same
 *     canonical club even if they happen to share a real-world club and its
 *     SFV clubNumber.
 *   - NEVER touches a team whose `providerTeamId` is absent from the
 *     caller-supplied `resolvedClubIdsByTeamId` map — i.e. never guesses at
 *     consolidating a team the caller has no strong identity evidence for.
 *     This is the "do not delete/merge uncertain records automatically"
 *     requirement: uncertain records are left untouched, not force-merged.
 *   - IDEMPOTENT: once every team sharing a `providerClubId` already points
 *     at the same ExternalClub, re-running with the same input is a
 *     no-op (aside from a harmless mapping upsert confirming the identity
 *     link, itself idempotent).
 *
 * ─── Canonical club selection ───────────────────────────────────────────────────
 *
 * When a group's teams currently span MORE than one distinct ExternalClub:
 *   1. If an ExternalClubProviderMapping already exists for this exact
 *      (tenantId, provider, providerClubId) and its club is among the
 *      group, that club is ALWAYS the canonical one — this keeps the
 *      canonical identity stable across repeated runs even as new teams
 *      are discovered, rather than re-deriving a potentially different
 *      "earliest" club on every run.
 *   2. Otherwise, prefer a non-archived club over an archived one (a
 *      deliberately archived shell should not be silently "revived" as the
 *      survivor when an active alternative exists).
 *   3. Otherwise, the club with the earliest `createdAt` wins (ties broken
 *      by `id` for full determinism) — mirrors the same convention already
 *      used by scripts/team-sfv-mapping-01-fca-reconciliation.ts.
 *
 * ─── Logo completeness during consolidation ────────────────────────────────────
 *
 * Per the LOGO COMPLETENESS priority order:
 *   1. If the canonical club already has ANY logoUrl (tenant-managed or
 *      previously provider-filled), it is NEVER touched.
 *   2. Otherwise, the first non-null `logoUrl` found among the losing
 *      clubs being merged away (deterministic: sorted by `id`) is adopted
 *      onto the canonical club — "preserve/adopt an existing valid provider
 *      crest from consolidated records."
 *   (Priority #3 — trying additional linked SFV team IDs via
 *   fetchTeamPicture — is a live-network operation and is therefore the SFV
 *   orchestrator's responsibility, not this pure module's; see
 *   lib/integrations/sfv/sync/team-logo.ts#resolveClubLogoFromCandidateTeamIds
 *   and external-team-discovery.ts, wired into ordinary sync — this module
 *   only ever adopts logos that ALREADY exist in the database.)
 */

// ── Row shapes (structural — match Prisma's shape) ─────────────────────────────

export type ConsolidationTeamMappingRow = {
  externalTeamId: string;
  providerTeamId: number;
  externalTeam: {
    id: string;
    externalClubId: string;
    archivedAt: Date | null;
  };
};

export type ConsolidationClubRow = {
  id: string;
  logoUrl: string | null;
  createdAt: Date;
  archivedAt: Date | null;
};

export type ConsolidationClubMappingRow = {
  id: string;
  externalClubId: string;
};

// ── Database interface ─────────────────────────────────────────────────────────

export interface ClubConsolidationDatabase {
  externalTeamProviderMapping: {
    findMany(args: object): Promise<ConsolidationTeamMappingRow[]>;
  };
  externalTeam: {
    update(args: object): Promise<{ id: string; externalClubId: string }>;
  };
  externalClub: {
    findMany(args: object): Promise<ConsolidationClubRow[]>;
    update(args: object): Promise<ConsolidationClubRow>;
  };
  externalClubProviderMapping: {
    findFirst(args: object): Promise<ConsolidationClubMappingRow | null>;
    upsert(args: object): Promise<ConsolidationClubMappingRow>;
  };
  /**
   * Runs `fn` against a transactional view of this database. Implementations
   * MUST provide real atomicity — if `fn` throws, every write performed
   * through the transactional database passed to `fn` is rolled back as a
   * single unit. Used to make "move every team + adopt a logo + archive
   * losing clubs + upsert the club-provider mapping" all-or-nothing per
   * group, so a mid-merge failure never leaves teams split across a
   * half-migrated state.
   */
  transaction<T>(fn: (tx: ClubConsolidationDatabase) => Promise<T>): Promise<T>;
}

// ── Public types ────────────────────────────────────────────────────────────────

export type ConsolidateExternalClubsInput = {
  tenantId: string;
  /** External provider identifier, e.g. "SFV". Case-insensitive; stored upper-case. */
  provider: string;
  /**
   * Pre-resolved `providerTeamId -> providerClubId` identity map for this
   * run — the ONLY source of truth this module consults for "do these two
   * teams belong to the same real-world club". Never derived from names.
   */
  resolvedClubIdsByTeamId: ReadonlyMap<number, number>;
};

export type ConsolidationGroupOutcome =
  | {
      status: "already-consolidated";
      providerClubId: number;
      canonicalClubId: string;
    }
  | {
      status: "merged";
      providerClubId: number;
      canonicalClubId: string;
      /** ExternalClub ids merged away (archived) into the canonical club. */
      mergedClubIds: string[];
      /** Number of ExternalTeam rows re-parented onto the canonical club. */
      teamsMoved: number;
      /** The losing ExternalClub id a logo was adopted from, or null. */
      logoAdoptedFromClubId: string | null;
    };

export type ConsolidationResult = {
  /** Number of distinct providerClubId groups examined this run. */
  groupsProcessed: number;
  /** Groups where two or more distinct ExternalClub rows were merged into one. */
  groupsMerged: number;
  /** Groups already pointing at a single canonical ExternalClub — no-op. */
  groupsAlreadyConsolidated: number;
  /** Total ExternalTeam rows re-parented across every merged group. */
  teamsMoved: number;
  /** Total ExternalClub rows archived (never deleted) across every merged group. */
  clubsArchived: number;
  details: ConsolidationGroupOutcome[];
};

// ── Internal helpers ────────────────────────────────────────────────────────────

function requireIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

/**
 * Chooses the canonical ExternalClub for a group of currently-distinct
 * clubs, per the priority order documented in the module header.
 *
 * Exported (not just internal) so the read-only backfill script
 * (scripts/club-directory-02c-sfv-consolidation.ts) can preview EXACTLY the
 * same canonical-selection decision this service will make under
 * `--execute`, without duplicating the logic and risking the preview and
 * the real behaviour drifting apart.
 */
export function chooseCanonicalClubId(
  clubRows: readonly ConsolidationClubRow[],
  preferredClubId: string | null,
): string {
  if (preferredClubId !== null && clubRows.some((c) => c.id === preferredClubId)) {
    return preferredClubId;
  }

  const active = clubRows.filter((c) => c.archivedAt === null);
  const candidates = active.length > 0 ? active : clubRows;

  const sorted = [...candidates].sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });

  return sorted[0].id;
}

/**
 * Adopts a logo onto the canonical club ONLY when it currently has none —
 * mirrors lib/club-directory/logo.ts#mergeProviderLogoUrl's "tenant/existing
 * value always wins" rule, applied across the merged set instead of a
 * single provider sync payload.
 *
 * Exported for the same reason as `chooseCanonicalClubId` above — shared
 * read-only preview logic for the backfill script.
 */
export function chooseLogoDonor(
  canonicalClub: ConsolidationClubRow,
  losingClubs: readonly ConsolidationClubRow[],
): { logoUrl: string; donorClubId: string } | null {
  if (canonicalClub.logoUrl !== null && canonicalClub.logoUrl.trim() !== "") {
    return null;
  }

  const donor = [...losingClubs]
    .filter((c) => c.logoUrl !== null && c.logoUrl.trim() !== "")
    .sort((a, b) => a.id.localeCompare(b.id))[0];

  return donor ? { logoUrl: donor.logoUrl as string, donorClubId: donor.id } : null;
}

/**
 * Creates or re-points the ExternalClubProviderMapping for this
 * (tenantId, provider, providerClubId) to the canonical club. Idempotent —
 * a no-op when it already points there.
 */
async function ensureClubProviderMapping(
  database: ClubConsolidationDatabase,
  tenantId: string,
  provider: string,
  providerClubId: number,
  canonicalClubId: string,
  now: Date,
): Promise<void> {
  await database.externalClubProviderMapping.upsert({
    where: { tenantId_provider_providerClubId: { tenantId, provider, providerClubId } },
    create: {
      tenantId,
      externalClubId: canonicalClubId,
      provider,
      providerClubId,
      providerIsActive: true,
      lastSyncedAt: now,
    },
    update: { externalClubId: canonicalClubId },
  });
}

// ── Public service function ───────────────────────────────────────────────────

/**
 * Reconciles pre-existing duplicate ExternalClub rows for every
 * `providerTeamId` covered by `input.resolvedClubIdsByTeamId`.
 *
 * For each distinct `providerClubId` in the map:
 *   1. Loads every ExternalTeamProviderMapping (this tenant/provider) whose
 *      `providerTeamId` resolves to that `providerClubId`.
 *   2. If those teams already all share one ExternalClub, upserts the
 *      ExternalClubProviderMapping to confirm the identity link and moves
 *      on — no-op otherwise (idempotent rerun).
 *   3. If they currently span MORE than one ExternalClub, merges them: every
 *      team is re-parented onto ONE chosen canonical club, a logo is
 *      adopted from a losing club when the canonical one has none, every
 *      losing club is archived (never deleted), and the
 *      ExternalClubProviderMapping is upserted to the canonical club — all
 *      inside one transaction per group.
 *
 * Never touches a team whose `providerTeamId` is not a key of
 * `resolvedClubIdsByTeamId` — those are left exactly as-is (uncertain
 * records are never force-merged).
 */
export async function consolidateExternalClubsByProviderIdentity(
  database: ClubConsolidationDatabase,
  input: ConsolidateExternalClubsInput,
  now: Date = new Date(),
): Promise<ConsolidationResult> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();

  const providerTeamIds = [...input.resolvedClubIdsByTeamId.keys()];

  const result: ConsolidationResult = {
    groupsProcessed: 0,
    groupsMerged: 0,
    groupsAlreadyConsolidated: 0,
    teamsMoved: 0,
    clubsArchived: 0,
    details: [],
  };

  if (providerTeamIds.length === 0) {
    return result;
  }

  const mappingRows = await database.externalTeamProviderMapping.findMany({
    where: { tenantId, provider, providerTeamId: { in: providerTeamIds } },
  });

  const groups = new Map<number, ConsolidationTeamMappingRow[]>();
  for (const row of mappingRows) {
    const providerClubId = input.resolvedClubIdsByTeamId.get(row.providerTeamId);
    if (providerClubId === undefined) continue; // defensive — filtered by the query's own `in` clause
    const list = groups.get(providerClubId);
    if (list) {
      list.push(row);
    } else {
      groups.set(providerClubId, [row]);
    }
  }

  result.groupsProcessed = groups.size;

  for (const [providerClubId, rows] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const distinctClubIds = [...new Set(rows.map((r) => r.externalTeam.externalClubId))].sort();

    if (distinctClubIds.length <= 1) {
      const canonicalClubId = distinctClubIds[0];
      if (canonicalClubId !== undefined) {
        await ensureClubProviderMapping(database, tenantId, provider, providerClubId, canonicalClubId, now);
      }
      result.groupsAlreadyConsolidated++;
      result.details.push({
        status: "already-consolidated",
        providerClubId,
        canonicalClubId: canonicalClubId ?? "",
      });
      continue;
    }

    const existingClubMapping = await database.externalClubProviderMapping.findFirst({
      where: { tenantId, provider, providerClubId },
    });
    const preferredClubId =
      existingClubMapping !== null && distinctClubIds.includes(existingClubMapping.externalClubId)
        ? existingClubMapping.externalClubId
        : null;

    const clubRows = await database.externalClub.findMany({
      where: { tenantId, id: { in: distinctClubIds } },
    });

    const canonicalClubId = chooseCanonicalClubId(clubRows, preferredClubId);
    const losingClubIds = distinctClubIds.filter((id) => id !== canonicalClubId);
    const canonicalClub = clubRows.find((c) => c.id === canonicalClubId);
    const losingClubs = clubRows.filter((c) => losingClubIds.includes(c.id));

    if (canonicalClub === undefined) {
      // Defensive only — every distinctClubIds entry came from a real
      // ExternalTeam.externalClubId, so its ExternalClub must exist.
      continue;
    }

    const merged = await database.transaction(async (tx) => {
      let teamsMoved = 0;
      for (const row of rows) {
        if (row.externalTeam.externalClubId !== canonicalClubId) {
          await tx.externalTeam.update({
            where: { id: row.externalTeamId },
            data: { externalClubId: canonicalClubId },
          });
          teamsMoved++;
        }
      }

      const donor = chooseLogoDonor(canonicalClub, losingClubs);
      if (donor !== null) {
        await tx.externalClub.update({
          where: { id: canonicalClubId },
          data: { logoUrl: donor.logoUrl },
        });
      }

      for (const losingId of losingClubIds) {
        await tx.externalClub.update({
          where: { id: losingId },
          data: { archivedAt: now },
        });
      }

      await ensureClubProviderMapping(tx, tenantId, provider, providerClubId, canonicalClubId, now);

      return { teamsMoved, logoAdoptedFromClubId: donor?.donorClubId ?? null };
    });

    result.teamsMoved += merged.teamsMoved;
    result.clubsArchived += losingClubIds.length;
    result.groupsMerged++;
    result.details.push({
      status: "merged",
      providerClubId,
      canonicalClubId,
      mergedClubIds: losingClubIds,
      teamsMoved: merged.teamsMoved,
      logoAdoptedFromClubId: merged.logoAdoptedFromClubId,
    });
  }

  return result;
}
