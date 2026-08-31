/**
 * lib/club-directory/standings-club-enrichment.ts
 *
 * Batch canonical club enrichment for provider standings rows.
 * Loads explicit provider mappings and canonical club indexes once, then
 * resolves all rows in memory.
 */

import { prisma } from "@/lib/db/prisma";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import {
  buildCanonicalClubNameIndexes,
  type CanonicalClubResolutionSource,
  type ResolvedCanonicalClub,
  resolveCanonicalClubFromProviderTeamName,
} from "./canonical-club-resolution";
import {
  collectProviderClubIdsFromExternalTeams,
  loadCanonicalClubLogoIndex,
  resolveExternalTeamLogoWithCanonicalFallback,
} from "./canonical-logo-resolution";

export type StandingsProviderTeamRow = {
  readonly providerTeamId: number;
  readonly providerTeamName: string;
};

export type StandingsClubEnrichment = {
  readonly canonicalClubId: string | null;
  /** Compact label from ExternalTeam/ExternalClub shortName only — never a full club name. */
  readonly shortName: string | null;
  readonly logoUrl: string | null;
  readonly resolutionSource: CanonicalClubResolutionSource | "unresolved";
  /**
   * SFV team label from an explicit ExternalTeamProviderMapping row.
   * When present, standings presentation prefers this over ranking teamName
   * because ranking payloads can surface club-level aliases for the same teamId.
   */
  readonly providerTeamName: string | null;
};

type ExplicitStandingsExternalTeamRecord = {
  readonly shortName: string | null;
  readonly logoUrl: string | null;
  readonly externalClub: {
    readonly id: string;
    readonly name: string;
    readonly shortName: string | null;
    readonly logoUrl: string | null;
  };
  readonly providerMappings: ReadonlyArray<{
    readonly providerTeamId: number;
    readonly providerClubId: number | null;
    readonly providerTeamName: string | null;
  }>;
};

export interface StandingsClubEnrichmentDatabase {
  externalTeam: {
    findMany(args: object): Promise<ExplicitStandingsExternalTeamRecord[]>;
  };
  externalClub: {
    findMany(args: object): Promise<
      Array<{
        id: string;
        name: string;
        shortName: string | null;
        alternativeName: string | null;
        logoUrl: string | null;
        providerMappings: Array<{ providerClubName: string | null }>;
      }>
    >;
  };
}

function toAutoResolvedEnrichment(
  resolved: ResolvedCanonicalClub,
): StandingsClubEnrichment {
  return {
    canonicalClubId: resolved.id,
    shortName: resolved.shortName,
    logoUrl: resolved.logoUrl,
    resolutionSource: resolved.source,
    providerTeamName: null,
  };
}

/**
 * Builds canonical club enrichment for standings rows keyed by providerTeamId.
 *
 * Priority per row:
 *   1. Explicit ExternalTeam provider mapping
 *   2. Exact normalized canonical club-name/alias match
 *   3. Longest valid canonical club-name/alias prefix match
 *   4. Unresolved
 */
export async function buildStandingsClubEnrichmentByProviderTeamId(
  input: {
    readonly tenantId: string;
    readonly rows: readonly StandingsProviderTeamRow[];
    readonly database?: StandingsClubEnrichmentDatabase;
  },
): Promise<Map<number, StandingsClubEnrichment>> {
  const database = input.database ?? (prisma as unknown as StandingsClubEnrichmentDatabase);
  const enrichmentByProviderTeamId = new Map<number, StandingsClubEnrichment>();

  const uniqueRows = new Map<number, string>();
  for (const row of input.rows) {
    if (!uniqueRows.has(row.providerTeamId)) {
      uniqueRows.set(row.providerTeamId, row.providerTeamName);
    }
  }

  const providerTeamIds = [...uniqueRows.keys()];
  if (providerTeamIds.length === 0) {
    return enrichmentByProviderTeamId;
  }

  const [explicitExternalTeams, canonicalClubs] = await Promise.all([
    database.externalTeam.findMany({
      where: {
        tenantId: input.tenantId,
        providerMappings: {
          some: {
            provider: SFV_PROVIDER,
            providerTeamId: { in: providerTeamIds },
          },
        },
      },
      select: {
        shortName: true,
        logoUrl: true,
        externalClub: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        providerMappings: {
          where: {
            provider: SFV_PROVIDER,
            providerTeamId: { in: providerTeamIds },
          },
          select: {
            providerTeamId: true,
            providerClubId: true,
            providerTeamName: true,
          },
        },
      },
    }),
    database.externalClub.findMany({
      where: {
        tenantId: input.tenantId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        alternativeName: true,
        logoUrl: true,
        providerMappings: {
          select: { providerClubName: true },
        },
      },
    }),
  ]);

  const canonicalLogoByProviderClubId = await loadCanonicalClubLogoIndex(
    input.tenantId,
    collectProviderClubIdsFromExternalTeams(explicitExternalTeams),
  );

  const resolvedProviderTeamIds = new Set<number>();

  for (const externalTeam of explicitExternalTeams) {
    const logoUrl = resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: externalTeam,
        directClub: externalTeam.externalClub,
        providerMappings: externalTeam.providerMappings,
      },
      canonicalLogoByProviderClubId,
    );

    for (const providerMapping of externalTeam.providerMappings) {
      resolvedProviderTeamIds.add(providerMapping.providerTeamId);
      enrichmentByProviderTeamId.set(providerMapping.providerTeamId, {
        canonicalClubId: externalTeam.externalClub.id,
        shortName: externalTeam.shortName ?? externalTeam.externalClub.shortName,
        logoUrl,
        resolutionSource: "explicit_provider_mapping",
        providerTeamName: providerMapping.providerTeamName,
      });
    }
  }

  const autoResolutionIndexes = buildCanonicalClubNameIndexes(canonicalClubs);

  for (const [providerTeamId, providerTeamName] of uniqueRows) {
    if (resolvedProviderTeamIds.has(providerTeamId)) {
      continue;
    }

    const resolved = resolveCanonicalClubFromProviderTeamName(
      providerTeamName,
      autoResolutionIndexes,
    );

    enrichmentByProviderTeamId.set(
      providerTeamId,
      resolved
        ? toAutoResolvedEnrichment(resolved)
        : {
            canonicalClubId: null,
            shortName: null,
            logoUrl: null,
            resolutionSource: "unresolved",
            providerTeamName: null,
          },
    );
  }

  return enrichmentByProviderTeamId;
}
