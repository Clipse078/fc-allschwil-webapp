/**
 * lib/club-directory/canonical-club-resolution.ts
 *
 * CLUB-AUTO-RESOLUTION-01 — deterministic canonical club resolution for
 * provider team/opponent labels that lack an explicit provider mapping.
 *
 * Resolution priority:
 *   1. Existing explicit/provider mapping (handled by callers before fallback)
 *   2. Exact normalized canonical club-name/alias match
 *   3. Longest valid canonical club-name/alias prefix match
 *   4. Unresolved/null
 */

import {
  hasCanonicalPrefixBoundary,
  normalizeClubNameForLookup,
} from "./club-name-normalization";
import { resolveExternalClubLogoUrl } from "./logo";

export type CanonicalClubRecord = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly logoUrl: string | null;
};

export type CanonicalClubResolutionSource =
  | "explicit_provider_mapping"
  | "exact_name_match"
  | "prefix_name_match";

export type ResolvedCanonicalClub = CanonicalClubRecord & {
  readonly source: CanonicalClubResolutionSource;
};

export type CanonicalClubDirectoryRow = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly alternativeName: string | null;
  readonly logoUrl: string | null;
  readonly providerMappings?: readonly {
    readonly providerClubName: string | null;
  }[];
};

export type CanonicalClubNameIndexes = {
  readonly exactIndex: ReadonlyMap<string, CanonicalClubRecord>;
  readonly prefixVariants: readonly {
    readonly normalized: string;
    readonly variantLength: number;
    readonly club: CanonicalClubRecord;
  }[];
};

function toCanonicalClubRecord(club: CanonicalClubDirectoryRow): CanonicalClubRecord {
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    logoUrl: resolveExternalClubLogoUrl(club),
  };
}

function addNameVariant(
  exactIndex: Map<string, CanonicalClubRecord>,
  prefixVariants: Array<{
    normalized: string;
    variantLength: number;
    club: CanonicalClubRecord;
  }>,
  rawName: string | null | undefined,
  club: CanonicalClubRecord,
): void {
  const trimmed = rawName?.trim();
  if (!trimmed) return;

  const normalized = normalizeClubNameForLookup(trimmed);
  if (!normalized) return;

  if (!exactIndex.has(normalized)) {
    exactIndex.set(normalized, club);
  }

  prefixVariants.push({
    normalized,
    variantLength: normalized.length,
    club,
  });
}

/**
 * Builds in-memory lookup indexes from tenant-scoped canonical clubs.
 */
export function buildCanonicalClubNameIndexes(
  clubs: readonly CanonicalClubDirectoryRow[],
): CanonicalClubNameIndexes {
  const exactIndex = new Map<string, CanonicalClubRecord>();
  const prefixVariants: Array<{
    normalized: string;
    variantLength: number;
    club: CanonicalClubRecord;
  }> = [];

  for (const club of clubs) {
    const record = toCanonicalClubRecord(club);

    addNameVariant(exactIndex, prefixVariants, club.name, record);
    addNameVariant(exactIndex, prefixVariants, club.shortName, record);
    addNameVariant(exactIndex, prefixVariants, club.alternativeName, record);

    for (const mapping of club.providerMappings ?? []) {
      addNameVariant(exactIndex, prefixVariants, mapping.providerClubName, record);
    }
  }

  prefixVariants.sort((left, right) => right.variantLength - left.variantLength);

  return {
    exactIndex,
    prefixVariants,
  };
}

/**
 * Resolves a provider team display label to a canonical club using exact and
 * longest-prefix matching. Explicit provider mappings must be applied by the
 * caller before invoking this fallback.
 */
export function resolveCanonicalClubFromProviderTeamName(
  providerTeamName: string,
  indexes: CanonicalClubNameIndexes,
): ResolvedCanonicalClub | null {
  const trimmed = providerTeamName.trim();
  if (!trimmed) return null;

  const normalized = normalizeClubNameForLookup(trimmed);
  if (!normalized) return null;

  const exactMatch = indexes.exactIndex.get(normalized);
  if (exactMatch) {
    return {
      ...exactMatch,
      source: "exact_name_match",
    };
  }

  for (const variant of indexes.prefixVariants) {
    if (variant.variantLength === 0) continue;
    if (!normalized.startsWith(variant.normalized)) continue;
    if (!hasCanonicalPrefixBoundary(normalized, variant.variantLength)) continue;

    return {
      ...variant.club,
      source: "prefix_name_match",
    };
  }

  return null;
}
