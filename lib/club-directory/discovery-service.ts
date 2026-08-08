/**
 * lib/club-directory/discovery-service.ts
 *
 * CLUB-DIRECTORY-02 — SFV Discovery & Automatic Enrichment.
 * CLUB-DIRECTORY-02C — Canonical Club Consolidation.
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
 * Club identity (CLUB-DIRECTORY-02C — see docs/integrations/
 * sfv-slice-club-directory-02c-canonical-consolidation.md for the full
 * investigation):
 *   SFV's schedule endpoint (GET /api/club/schedule) reports only the
 *   opponent's numeric teamId and display name — never a club-level
 *   identifier for the opponent side. However, SFV DOES expose a stable,
 *   provider-assigned club identifier — `clubNumber` — via two already-
 *   implemented, already-tested endpoints: `TeamDetail.clubNumber`
 *   (GET /api/team/list, own club's teams) and `ClubRankingEntry.clubNumber`
 *   (GET /api/club/ranking, every team — own AND opponents — appearing in
 *   the tenant's league/group standings). The SFV-specific adapter
 *   (lib/integrations/sfv/sync/club-identity.ts) resolves this per-teamId
 *   `clubNumber` and passes it here as `providerClubId` — the SAME field
 *   this module's schema (`ExternalClubProviderMapping.providerClubId`,
 *   `ExternalTeamProviderMapping.providerClubId`) already reserved for
 *   exactly this purpose since CLUB-DIRECTORY-01.
 *
 *   When `providerClubId` is supplied, this module resolves-or-creates the
 *   canonical ExternalClub by that identity — a real SFV club always
 *   consolidates onto ONE ExternalClub no matter how many of its teams are
 *   discovered, in any order, across any number of sync runs. Suffixes like
 *   "B1", "C2", "D7 gelb" are never inspected or stripped — identity is
 *   exclusively the provider-assigned numeric clubNumber, never a guess from
 *   the team name.
 *
 *   When `providerClubId` is NOT available (ranking coverage did not yet
 *   include this specific opponent this run — e.g. a cup/friendly opponent
 *   outside every league group the tenant's own teams currently rank in),
 *   this module falls back to the pre-CLUB-DIRECTORY-02C behaviour: a
 *   brand-new opponent team is discovered with its own dedicated
 *   ExternalClub (name defaults to the team's display name). This is a
 *   narrow, explicitly documented fallback — never a silent guess — and is
 *   exactly what the backfill/consolidation mechanism
 *   (lib/club-directory/consolidation-service.ts) exists to reconcile once
 *   identity evidence for that team becomes available (e.g. a later sync
 *   where the opponent's league group is covered by ranking data). A tenant
 *   admin can always correct auto-generated club/team names or re-parent a
 *   team to the correct club manually — that tenant-managed edit is never
 *   overwritten by a subsequent sync (see mutation-service.ts).
 *
 * Concurrency (CLUB-DIRECTORY-02 fix, extended by CLUB-DIRECTORY-02C):
 *   Two overlapping discovery calls for the same brand-new
 *   (tenantId, provider, providerTeamId, providerSeasonId) must never both
 *   commit their own ExternalTeam. The "create the shell" branch below
 *   therefore creates the ExternalTeam AND a placeholder
 *   ExternalTeamProviderMapping row that *claims* the identity — inside one
 *   `database.transaction()`. The mapping create is a plain `create()`
 *   (never `upsert()`): if a concurrent caller already committed the same
 *   identity first, this create hits the real unique constraint and throws
 *   `ClubDirectoryUniqueConstraintError`, which rolls back the transaction —
 *   the team included — leaving no orphan behind. The losing caller then
 *   re-reads the now-guaranteed-visible winning mapping and adopts its
 *   ExternalTeam instead of retrying its own (already rolled back) shell.
 *
 *   CLUB-DIRECTORY-02C adds a SECOND, independent race guard one level up:
 *   when a brand-new `providerClubId` (never seen before by this tenant)
 *   is claimed by creating a new ExternalClub + ExternalClubProviderMapping,
 *   the mapping create is likewise a plain `create()` guarded by the real
 *   `@@unique([tenantId, provider, providerClubId])` constraint. Two
 *   overlapping discovery calls for two DIFFERENT brand-new teams that
 *   happen to share the same brand-new clubNumber can therefore never both
 *   commit their own ExternalClub — the loser rolls back (nothing committed
 *   yet — the club-mapping claim happens before the team is even created in
 *   that transaction), re-reads the winning ExternalClubProviderMapping, and
 *   attaches its own new ExternalTeam under the WINNER's club instead of
 *   creating a duplicate. See lib/club-directory/__tests__/
 *   discovery-service.test.ts and discovery-service-concurrency.integration.
 *   test.ts for the sequential and genuinely-concurrent-Postgres proofs of
 *   both race guards.
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

/**
 * CLUB-DIRECTORY-02C — normalizes a caller-supplied `providerClubId` into
 * either a positive integer or `null`. Never throws: an invalid value
 * (missing, zero, negative, non-integer) is treated exactly like "no club
 * identity evidence available" — the narrow, documented fallback (dedicated
 * per-team club) — rather than aborting discovery over a malformed optional
 * hint.
 */
function normalizeProviderClubId(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value > 0 ? value : null;
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
  /**
   * CLUB-DIRECTORY-04 — provider-reported league/competition name, when the
   * provider payload exposes one (e.g. SFV ClubRankingEntry.leagueName).
   * Provider-owned; forwarded verbatim to linkExternalTeamProvider — never
   * inspected, never used to derive identity or club membership.
   */
  providerLeagueName?: string | null;
  /**
   * CLUB-DIRECTORY-04 — provider-reported competition group name, when the
   * provider payload exposes one (e.g. SFV ClubRankingEntry.groupName).
   */
  providerGroupName?: string | null;
  providerIsActive?: boolean;
};

export type DiscoverExternalTeamResult = {
  club: ExternalClubRow;
  team: ExternalTeamRow;
  /** True only when this call created a brand-new canonical club/team pair. */
  discovered: boolean;
};

type MappingKey = {
  tenantId: string;
  provider: string;
  providerTeamId: number;
  providerSeasonId: number;
};

// ── Internal: club-identity race signal ───────────────────────────────────────

/**
 * CLUB-DIRECTORY-02C — thrown internally (never exported, never crosses this
 * module's public boundary) when a concurrent caller already claimed the
 * exact (tenantId, provider, providerClubId) identity this call was about
 * to create for the first time. Distinct from the team-level
 * `ClubDirectoryUniqueConstraintError` recovery path (which returns `null`)
 * because the caller needs a different recovery action here: re-read the
 * WINNING ExternalClub and attach its own new ExternalTeam under it, rather
 * than adopting a whole different team.
 */
class ClubIdentityRaceLostError extends Error {
  constructor() {
    super("Concurrent caller already claimed this providerClubId.");
    this.name = "ClubIdentityRaceLostError";
  }
}

// ── Internal: shell creation ───────────────────────────────────────────────────

/**
 * Creates a brand-new ExternalTeam and claims the
 * (tenantId, provider, providerTeamId, providerSeasonId) identity, attaching
 * it to an ALREADY-RESOLVED `externalClubId` — used both when
 * `providerClubId` resolved to a pre-existing club (CLUB-DIRECTORY-02C) and,
 * with a freshly-created dedicated club id, for the narrow "no club identity
 * evidence" fallback (pre-CLUB-DIRECTORY-02C behaviour).
 *
 * Returns the newly-created ExternalTeam id on success. Returns null when a
 * concurrent caller won the TEAM-identity race — the unique constraint on
 * ExternalTeamProviderMapping caused this transaction's own mapping
 * `create()` to fail, rolling back the team created earlier in the SAME
 * transaction. Any other error propagates unchanged.
 */
async function createTeamShellUnderClub(
  database: ClubDirectoryMutationDatabase,
  key: MappingKey,
  fallbackName: string,
  externalClubId: string,
): Promise<string | null> {
  try {
    const team = await database.transaction(async (tx) => {
      const createdTeam = await tx.externalTeam.create({
        data: {
          tenantId: key.tenantId,
          externalClubId,
          name: fallbackName,
          source: key.provider,
        },
      });

      // Plain create() — never upsert() — is what makes this race-safe: a
      // concurrent winner's already-committed row causes THIS create to hit
      // the real unique constraint and throw, which rolls back the whole
      // transaction (the team included). Provider-owned fields
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
 * Creates a brand-new ExternalClub — optionally claiming a provider club
 * identity (`providerClubId`, CLUB-DIRECTORY-02C) — AND its first
 * ExternalTeam (+ team-identity claim), all atomically.
 *
 * Two independent race outcomes are surfaced distinctly to the caller:
 *   - CLUB-identity race lost (`providerClubId` is not null and a
 *     concurrent caller already claimed it) → throws
 *     `ClubIdentityRaceLostError`. Nothing from this attempt is left
 *     behind — the whole transaction (the freshly-created ExternalClub
 *     included) rolls back. The caller must re-read the winning
 *     ExternalClubProviderMapping and retry team creation under the
 *     winner's club via `createTeamShellUnderClub`.
 *   - TEAM-identity race lost (the same recovery as pre-CLUB-DIRECTORY-02C)
 *     → returns `null`.
 */
async function createClubAndTeamShell(
  database: ClubDirectoryMutationDatabase,
  key: MappingKey,
  fallbackName: string,
  providerClubId: number | null,
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

      if (providerClubId !== null) {
        try {
          // Plain create() — never upsert() — claims the CLUB identity the
          // same race-safe way the team-identity claim below does: a
          // concurrent winner's already-committed mapping causes this to
          // hit the real unique constraint and throw, rolling back this
          // entire transaction (the just-created ExternalClub included).
          await tx.externalClubProviderMapping.create({
            data: {
              tenantId: key.tenantId,
              externalClubId: club.id,
              provider: key.provider,
              providerClubId,
            },
          });
        } catch (err) {
          if (err instanceof ClubDirectoryUniqueConstraintError) {
            throw new ClubIdentityRaceLostError();
          }
          throw err;
        }
      }

      const createdTeam = await tx.externalTeam.create({
        data: {
          tenantId: key.tenantId,
          externalClubId: club.id,
          name: fallbackName,
          source: key.provider,
        },
      });

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
    if (err instanceof ClubIdentityRaceLostError) {
      throw err;
    }
    if (err instanceof ClubDirectoryUniqueConstraintError) {
      return null;
    }
    throw err;
  }
}

/**
 * CLUB-DIRECTORY-02C — resolves the canonical ExternalTeam's ExternalClub
 * for a brand-new provider identity, per the IDENTITY REQUIREMENT priority
 * order:
 *   1. `providerClubId` resolves to an ExternalClubProviderMapping already
 *      known to this tenant → attach the new team there (no new club).
 *   2. `providerClubId` is present but brand-new to this tenant → create
 *      exactly one new ExternalClub and claim it, race-safely.
 *   3. `providerClubId` is unavailable → narrow documented fallback: create
 *      a brand-new dedicated ExternalClub for this team alone (identical to
 *      pre-CLUB-DIRECTORY-02C behaviour). The consolidation/backfill
 *      mechanism (lib/club-directory/consolidation-service.ts) reconciles
 *      this once identity evidence becomes available on a later sync.
 *
 * Returns the resolved ExternalTeam id, or null when the TEAM-identity race
 * was lost (the caller re-reads and adopts the winning mapping — unchanged
 * from CLUB-DIRECTORY-02).
 */
async function resolveOrCreateTeamShell(
  database: ClubDirectoryMutationDatabase,
  key: MappingKey,
  fallbackName: string,
  providerClubId: number | null,
): Promise<string | null> {
  if (providerClubId !== null) {
    const existingClubMapping = await database.externalClubProviderMapping.findFirst({
      where: { tenantId: key.tenantId, provider: key.provider, providerClubId },
    });

    if (existingClubMapping !== null) {
      return createTeamShellUnderClub(database, key, fallbackName, existingClubMapping.externalClubId);
    }
  }

  try {
    return await createClubAndTeamShell(database, key, fallbackName, providerClubId);
  } catch (err) {
    if (err instanceof ClubIdentityRaceLostError) {
      // Lost the CLUB race: a concurrent caller already claimed this exact
      // providerClubId — its transaction is guaranteed to have already
      // committed by the time our create() saw the conflict, so this
      // re-read is guaranteed to find it. Attach our team there instead of
      // creating a second ExternalClub for the same real-world club.
      const winningClubMapping = await database.externalClubProviderMapping.findFirst({
        where: { tenantId: key.tenantId, provider: key.provider, providerClubId: providerClubId as number },
      });

      if (winningClubMapping === null) {
        // Defensive only — should be unreachable given the guarantee above.
        throw new ClubDirectoryNotFoundError("ExternalClubProviderMapping");
      }

      return createTeamShellUnderClub(database, key, fallbackName, winningClubMapping.externalClubId);
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
 * CLUB-DIRECTORY-02C: when `input.providerClubId` is supplied, a brand-new
 * team is attached to the SAME canonical ExternalClub as every other team
 * already known under that clubNumber — see `resolveOrCreateTeamShell`
 * above and the module doc header for the full identity strategy.
 *
 * Concurrency-safe: two overlapping calls for the same brand-new team
 * identity, or for two different brand-new teams sharing the same brand-new
 * club identity, can never both commit a duplicate club or team (see
 * resolveOrCreateTeamShell above) — the losing call transparently adopts
 * the winner's canonical record instead of surfacing an error or leaving an
 * orphan behind.
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
  const providerClubId = normalizeProviderClubId(input.providerClubId);

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

    const createdTeamId = await resolveOrCreateTeamShell(
      database,
      mappingKey,
      fallbackName,
      providerClubId,
    );

    if (createdTeamId !== null) {
      externalTeamId = createdTeamId;
      discovered = true;
    } else {
      // Lost the TEAM race: a concurrent call already claimed this identity
      // and (per Postgres's unique-index conflict semantics) its
      // transaction is guaranteed to have already committed by the time our
      // create() saw the conflict — so this re-read is guaranteed to find it.
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
      providerClubId,
      providerOrganisationId: input.providerOrganisationId ?? null,
      providerLogoUrl: input.providerLogoUrl ?? null,
      providerLeagueName: input.providerLeagueName ?? null,
      providerGroupName: input.providerGroupName ?? null,
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
