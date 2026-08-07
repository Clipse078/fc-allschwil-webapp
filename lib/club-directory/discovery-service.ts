/**
 * lib/club-directory/discovery-service.ts
 *
 * CLUB-DIRECTORY-02 — SFV Discovery & Automatic Enrichment.
 *
 * Provider-agnostic resolve-or-create flow for the canonical Club Directory
 * (ExternalClub / ExternalTeam), invoked when provider sync data (e.g. an
 * SFV schedule entry) references an external team that is not yet part of
 * the tenant's directory.
 *
 * This module deliberately does NOT duplicate the field-ownership rules
 * already implemented and tested in mutation-service.ts / provider-sync.ts —
 * it only decides whether a canonical ExternalClub/ExternalTeam pair needs
 * to be created, then delegates the actual provider-field upsert to
 * `linkExternalTeamProvider`, which already guarantees:
 *   - tenant-managed fields (name, shortName, alternativeName, logoUrl, …)
 *     are never overwritten by provider sync (STRICT OWNERSHIP RULE);
 *   - the same (tenantId, provider, providerTeamId, providerSeasonId) always
 *     resolves to the same canonical ExternalTeam (no duplicates across
 *     repeated syncs);
 *   - a provider identity already linked to a *different* ExternalTeam is
 *     rejected (identity integrity).
 *
 * Club grouping limitation (documented, not silently guessed):
 *   SFV's schedule endpoint (GET /api/club/schedule) reports only the
 *   opponent's numeric teamId and display name — never a club-level
 *   identifier (clubNumber) for the opponent side (unlike TeamDetail, which
 *   only covers the *configured* club's own teams). Without a stable
 *   provider club identity, a brand-new opponent team is discovered with
 *   its own dedicated ExternalClub (club name defaults to the team name).
 *   This keeps the club/team split structurally intact (every ExternalTeam
 *   still belongs to exactly one ExternalClub) without guessing a false
 *   grouping. When a caller DOES have a provider club identity (e.g. a
 *   future ranking-sync slice, which does report clubNumber, or manual
 *   admin linking), passing `providerClubId`/`providerClubName` lets
 *   multiple teams correctly consolidate under one resolved/created club.
 *   A tenant admin can always correct the auto-generated club/team names or
 *   re-parent a team to the correct club later — that tenant-managed edit is
 *   never overwritten by a subsequent sync (see mutation-service.ts).
 *
 * Concurrency (CLUB-DIRECTORY-02 fix):
 *   Two overlapping discovery calls for the same brand-new
 *   (tenantId, provider, providerTeamId, providerSeasonId) must never both
 *   commit their own ExternalClub/ExternalTeam pair. The "create the shell"
 *   branch below therefore creates the ExternalClub, ExternalTeam, AND a
 *   placeholder ExternalTeamProviderMapping row that *claims* the identity —
 *   all inside one `database.transaction()`. The mapping create is a plain
 *   `create()` (never `upsert()`): if a concurrent caller already committed
 *   the same identity first, this create hits the real unique constraint
 *   and throws `ClubDirectoryUniqueConstraintError`, which rolls back the
 *   ENTIRE transaction — the club and team included — leaving no orphan
 *   behind. The losing caller then re-reads the now-guaranteed-visible
 *   winning mapping and adopts its ExternalTeam instead of retrying its own
 *   (already rolled back) shell. See lib/club-directory/__tests__/
 *   discovery-service.test.ts and discovery-service-concurrency.integration.
 *   test.ts for the sequential and genuinely-concurrent-Postgres proofs.
 */

import {
  linkExternalTeamProvider,
  ClubDirectoryNotFoundError,
  ClubDirectoryUniqueConstraintError,
  type ClubDirectoryMutationDatabase,
  type ExternalClubRow,
  type ExternalTeamRow,
} from "./mutation-service";

// ── Local helpers (mirrors mutation-service.ts's private validation) ──────────

function requireIdentifier(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function requirePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ── Public types ────────────────────────────────────────────────────────────────

export type DiscoverExternalTeamInput = {
  tenantId: string;
  /** External provider identifier, e.g. "SFV". Case-insensitive; stored upper-case. */
  provider: string;
  /** Provider-assigned numeric team identifier (stable identity — never a name). */
  providerTeamId: number;
  /**
   * Provider-assigned season identifier. Defaults to 0 (seasonless sentinel —
   * see ExternalTeamProviderMapping schema doc) so the same physical opponent
   * team resolves to the same canonical ExternalTeam across season
   * transitions, matching the "avoid duplicate teams across repeated syncs"
   * requirement without needing season-scoped opponent bookkeeping.
   */
  providerSeasonId?: number;
  providerTeamName?: string | null;
  /** Provider-reported club identifier, when the provider payload exposes one. */
  providerClubId?: number | null;
  providerOrganisationId?: number | null;
  /** Provider-reported logo/crest URL, when the provider payload exposes one. */
  providerLogoUrl?: string | null;
  providerIsActive?: boolean;
};

export type DiscoverExternalTeamResult = {
  club: ExternalClubRow;
  team: ExternalTeamRow;
  /** True only when this call created a brand-new canonical club/team pair. */
  discovered: boolean;
};

// ── Public service function ───────────────────────────────────────────────────

/**
 * Atomically creates the canonical ExternalClub + ExternalTeam shell and
 * claims the (tenantId, provider, providerTeamId, providerSeasonId)
 * identity in a single transaction.
 *
 * Returns the newly-created ExternalTeam id on success. Returns null when a
 * concurrent caller won the race for this exact identity — the unique
 * constraint on ExternalTeamProviderMapping caused this transaction's own
 * mapping `create()` to fail, rolling back the club and team created
 * earlier in the SAME transaction. Any other error propagates unchanged.
 */
async function createShellAndClaimIdentity(
  database: ClubDirectoryMutationDatabase,
  key: { tenantId: string; provider: string; providerTeamId: number; providerSeasonId: number },
  fallbackName: string,
): Promise<string | null> {
  try {
    const team = await database.transaction(async (tx) => {
      const club = await tx.externalClub.create({
        data: {
          tenantId: key.tenantId,
          name: fallbackName,
          // Provider-discovered origin, informational only (never gates
          // identity or behaviour) — mirrors ExternalClub.source semantics
          // from CLUB-DIRECTORY-01.
          source: key.provider,
        },
      });

      const createdTeam = await tx.externalTeam.create({
        data: {
          tenantId: key.tenantId,
          externalClubId: club.id,
          name: fallbackName,
          source: key.provider,
        },
      });

      // Plain create() — never upsert() — is what makes this race-safe: a
      // concurrent winner's already-committed row causes THIS create to hit
      // the real unique constraint and throw, which rolls back the whole
      // transaction (club + team included). Provider-owned fields
      // (providerTeamName, providerLogoUrl, …) are intentionally NOT set
      // here — linkExternalTeamProvider() (called unconditionally by the
      // caller after this returns) is the single place that ever writes
      // them, on every path (new, reused, or race-recovered) alike.
      await tx.externalTeamProviderMapping.create({
        data: {
          tenantId: key.tenantId,
          externalTeamId: createdTeam.id,
          provider: key.provider,
          providerTeamId: key.providerTeamId,
          providerSeasonId: key.providerSeasonId,
        },
      });

      return createdTeam;
    });

    return team.id;
  } catch (err) {
    if (err instanceof ClubDirectoryUniqueConstraintError) {
      return null;
    }
    throw err;
  }
}

/**
 * Resolves the canonical ExternalClub/ExternalTeam for a provider-reported
 * team, creating the minimal canonical shell only when no matching
 * ExternalTeamProviderMapping exists yet for this tenant/provider/team/season.
 *
 * Idempotent: calling this repeatedly with the same
 * (tenantId, provider, providerTeamId, providerSeasonId) after the first
 * call never creates a second club/team pair — it always resolves to the
 * same canonical ExternalTeam and only refreshes provider-owned fields via
 * `linkExternalTeamProvider` (which itself never touches tenant-managed
 * fields once set).
 *
 * Concurrency-safe: two overlapping calls for the same brand-new identity
 * can never both commit a club/team pair (see createShellAndClaimIdentity
 * above) — the losing call transparently adopts the winner's canonical
 * ExternalTeam instead of surfacing an error or leaving an orphan behind.
 */
export async function discoverExternalTeamFromProvider(
  database: ClubDirectoryMutationDatabase,
  input: DiscoverExternalTeamInput,
  now: Date = new Date(),
): Promise<DiscoverExternalTeamResult> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");
  const provider = requireIdentifier(input.provider, "provider").toUpperCase();
  const providerTeamId = requirePositiveInteger(input.providerTeamId, "providerTeamId");
  const providerSeasonId = input.providerSeasonId ?? 0;
  const mappingKey = { tenantId, provider, providerTeamId, providerSeasonId };

  let externalTeamId: string;
  let discovered = false;

  const existingMapping = await database.externalTeamProviderMapping.findFirst({
    where: mappingKey,
  });

  if (existingMapping !== null) {
    externalTeamId = existingMapping.externalTeamId;
  } else {
    const fallbackName =
      normalizeOptionalString(input.providerTeamName) ?? `${provider} ${providerTeamId}`;

    const createdTeamId = await createShellAndClaimIdentity(database, mappingKey, fallbackName);

    if (createdTeamId !== null) {
      externalTeamId = createdTeamId;
      discovered = true;
    } else {
      // Lost the race: a concurrent call already claimed this identity and
      // (per Postgres's unique-index conflict semantics) its transaction is
      // guaranteed to have already committed by the time our create() saw
      // the conflict — so this re-read is guaranteed to find it.
      const winningMapping = await database.externalTeamProviderMapping.findFirst({
        where: mappingKey,
      });

      if (winningMapping === null) {
        // Defensive only — should be unreachable given the guarantee above.
        throw new ClubDirectoryNotFoundError("ExternalTeamProviderMapping");
      }

      externalTeamId = winningMapping.externalTeamId;
    }
  }

  const { team: updatedTeam } = await linkExternalTeamProvider(
    database,
    {
      tenantId,
      externalTeamId,
      provider,
      providerTeamId,
      providerSeasonId,
      providerTeamName: input.providerTeamName ?? null,
      providerClubId: input.providerClubId ?? null,
      providerOrganisationId: input.providerOrganisationId ?? null,
      providerLogoUrl: input.providerLogoUrl ?? null,
      providerIsActive: input.providerIsActive ?? true,
    },
    now,
  );

  const club = await database.externalClub.findFirst({
    where: { id: updatedTeam.externalClubId, tenantId },
  });

  if (club === null) {
    throw new ClubDirectoryNotFoundError("ExternalClub");
  }

  return { club, team: updatedTeam, discovered };
}
