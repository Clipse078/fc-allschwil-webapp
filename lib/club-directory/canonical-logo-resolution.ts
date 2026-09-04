/**
 * lib/club-directory/canonical-logo-resolution.ts
 *
 * Canonical external-club logo resolution for provider-linked ExternalTeams
 * whose direct parent ExternalClub may be a team-level shell without a crest,
 * while the tenant's canonical Verein (ExternalClub + ExternalClubProviderMapping)
 * already carries the club logo.
 *
 * Pure resolution helpers — database loading is performed at composition
 * boundaries (public weekplan feed, Infoboard loader, public team pages).
 */

import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import { prisma } from "@/lib/db/prisma";
import { normalizeClubNameForLookup } from "./club-name-normalization";
import {
  resolveExternalClubLogoUrl,
  resolveExternalTeamCanonicalLogoUrl,
  type LogoSource,
} from "./logo";

export type ProviderClubIdMappingRow = {
  readonly providerClubId: number | null;
};

export type CanonicalClubLogoMappingRow = {
  readonly providerClubId: number;
  readonly externalClub: LogoSource;
};

export type CanonicalClubLogoNameRow = {
  readonly logoUrl: string | null | undefined;
  readonly names: readonly (string | null | undefined)[];
};

/**
 * Picks the first positive providerClubId from an ExternalTeam's SFV mappings.
 */
export function pickProviderClubId(
  mappings: readonly ProviderClubIdMappingRow[] | null | undefined,
): number | null {
  if (!mappings) return null;
  for (const mapping of mappings) {
    const id = mapping.providerClubId;
    if (id !== null && Number.isInteger(id) && id > 0) {
      return id;
    }
  }
  return null;
}

/**
 * Indexes canonical Verein logos by providerClubId from pre-loaded mapping rows.
 */
export function buildCanonicalClubLogoIndex(
  rows: readonly CanonicalClubLogoMappingRow[],
): ReadonlyMap<number, string | null> {
  const index = new Map<number, string | null>();
  for (const row of rows) {
    index.set(row.providerClubId, resolveExternalClubLogoUrl(row.externalClub));
  }
  return index;
}

/**
 * Indexes canonical Verein logos by normalized tenant-managed/provider names.
 */
export function buildCanonicalClubLogoNameIndex(
  rows: readonly CanonicalClubLogoNameRow[],
): ReadonlyMap<string, string | null> {
  const index = new Map<string, string | null>();
  for (const row of rows) {
    const logoUrl = resolveExternalClubLogoUrl(row);
    for (const name of row.names) {
      const trimmed = name?.trim();
      if (!trimmed) continue;
      const normalized = normalizeClubNameForLookup(trimmed);
      if (normalized && !index.has(normalized)) {
        index.set(normalized, logoUrl);
      }
    }
  }
  return index;
}

export function resolveCanonicalClubLogoByName(
  names: readonly (string | null | undefined)[],
  index: ReadonlyMap<string, string | null>,
): string | null {
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const logoUrl = index.get(normalizeClubNameForLookup(trimmed));
    if (logoUrl) return logoUrl;
  }
  return null;
}

export type ExternalTeamLogoResolutionInput = {
  readonly team: LogoSource;
  readonly directClub: LogoSource;
  readonly providerMappings?: readonly ProviderClubIdMappingRow[] | null;
};

/**
 * Resolves an external-team logo using the canonical Verein fallback chain.
 */
export function resolveExternalTeamLogoWithCanonicalFallback(
  input: ExternalTeamLogoResolutionInput,
  canonicalLogoByProviderClubId: ReadonlyMap<number, string | null>,
): string | null {
  const providerClubId = pickProviderClubId(input.providerMappings);
  const canonicalLogo =
    providerClubId !== null
      ? canonicalLogoByProviderClubId.get(providerClubId) ?? null
      : null;

  return resolveExternalTeamCanonicalLogoUrl(
    input.team,
    input.directClub,
    { logoUrl: canonicalLogo },
  );
}

/**
 * Collects distinct providerClubIds referenced by external-team policy rows.
 */
export function collectProviderClubIdsFromExternalTeams(
  teams: readonly { readonly providerMappings?: readonly ProviderClubIdMappingRow[] | null }[],
): number[] {
  const ids = new Set<number>();
  for (const team of teams) {
    const providerClubId = pickProviderClubId(team.providerMappings);
    if (providerClubId !== null) ids.add(providerClubId);
  }
  return [...ids].sort((a, b) => a - b);
}

export const CANONICAL_EXTERNAL_TEAM_PROVIDER_MAPPING_SELECT = {
  where: { provider: SFV_PROVIDER },
  select: { providerClubId: true },
} as const;

export type EventPolicyExternalTeamRow = {
  readonly providerMappings?: readonly ProviderClubIdMappingRow[] | null;
};

/**
 * Collects providerClubIds from canonical event policy rows (match external mappings).
 */
export function collectProviderClubIdsFromEventPolicies(
  policies: readonly {
    readonly matchExternalMapping?: {
      readonly homeExternalTeam?: EventPolicyExternalTeamRow | null;
      readonly awayExternalTeam?: EventPolicyExternalTeamRow | null;
    } | null;
  }[],
): number[] {
  const teams: EventPolicyExternalTeamRow[] = [];
  for (const policy of policies) {
    const mapping = policy.matchExternalMapping;
    if (!mapping) continue;
    if (mapping.homeExternalTeam) teams.push(mapping.homeExternalTeam);
    if (mapping.awayExternalTeam) teams.push(mapping.awayExternalTeam);
  }
  return collectProviderClubIdsFromExternalTeams(teams);
}

/**
 * Loads canonical Verein logos keyed by providerClubId for one tenant.
 */
export async function loadCanonicalClubLogoIndex(
  tenantId: string,
  providerClubIds: readonly number[],
): Promise<ReadonlyMap<number, string | null>> {
  const unique = [...new Set(providerClubIds)].filter((id) => id > 0);
  if (unique.length === 0) return new Map();

  const rows = await prisma.externalClubProviderMapping.findMany({
    where: {
      tenantId,
      provider: SFV_PROVIDER,
      providerClubId: { in: unique },
    },
    select: {
      providerClubId: true,
      externalClub: { select: { logoUrl: true } },
    },
  });

  return buildCanonicalClubLogoIndex(rows);
}
