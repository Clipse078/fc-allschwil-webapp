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
 */

import {
  linkExternalTeamProvider,
  ClubDirectoryNotFoundError,
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

  const existingMapping = await database.externalTeamProviderMapping.findFirst({
    where: { tenantId, provider, providerTeamId, providerSeasonId },
  });

  let externalTeamId: string;
  let discovered = false;

  if (existingMapping !== null) {
    externalTeamId = existingMapping.externalTeamId;
  } else {
    const fallbackName =
      normalizeOptionalString(input.providerTeamName) ?? `${provider} ${providerTeamId}`;

    const club = await database.externalClub.create({
      data: {
        tenantId,
        name: fallbackName,
        // Provider-discovered origin, informational only (never gates
        // identity or behaviour) — mirrors ExternalClub.source semantics
        // from CLUB-DIRECTORY-01.
        source: provider,
      },
    });

    const team = await database.externalTeam.create({
      data: {
        tenantId,
        externalClubId: club.id,
        name: fallbackName,
        source: provider,
      },
    });

    externalTeamId = team.id;
    discovered = true;
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
