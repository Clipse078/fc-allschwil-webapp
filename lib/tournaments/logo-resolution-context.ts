/**
 * Tenant-scoped canonical Verein logo context for tournament participants.
 *
 * Provider-linked ExternalClubs are the canonical directory records. The
 * indexes built here let provider-discovered shell clubs resolve to those
 * records without copying logos onto participant or Infoboard entities.
 */

import {
  buildCanonicalClubLogoNameIndex,
  pickProviderClubId,
  resolveCanonicalClubLogoByName,
  type ProviderClubIdMappingRow,
} from "@/lib/club-directory/canonical-logo-resolution";
import { resolveExternalClubLogoUrl } from "@/lib/club-directory/logo";
import { prisma } from "@/lib/db/prisma";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";

export type TournamentCanonicalClubRow = {
  readonly name: string;
  readonly shortName: string | null;
  readonly alternativeName: string | null;
  readonly logoUrl: string | null;
  readonly providerMappings?: readonly {
    readonly providerClubId: number;
    readonly providerClubName: string | null;
  }[];
};

export type TournamentLogoResolutionContext = {
  readonly canonicalLogoByProviderClubId: ReadonlyMap<number, string | null>;
  readonly canonicalLogoByNormalizedClubName: ReadonlyMap<string, string | null>;
};

export const EMPTY_TOURNAMENT_LOGO_RESOLUTION_CONTEXT: TournamentLogoResolutionContext =
  {
    canonicalLogoByProviderClubId: new Map(),
    canonicalLogoByNormalizedClubName: new Map(),
  };

export function buildTournamentLogoResolutionContext(
  clubs: readonly TournamentCanonicalClubRow[],
): TournamentLogoResolutionContext {
  const canonicalLogoByProviderClubId = new Map<number, string | null>();

  for (const club of clubs) {
    const logoUrl = resolveExternalClubLogoUrl(club);
    for (const mapping of club.providerMappings ?? []) {
      canonicalLogoByProviderClubId.set(mapping.providerClubId, logoUrl);
    }
  }

  return {
    canonicalLogoByProviderClubId,
    canonicalLogoByNormalizedClubName: buildCanonicalClubLogoNameIndex(
      clubs.map((club) => ({
        logoUrl: club.logoUrl,
        names: [
          club.name,
          club.shortName,
          club.alternativeName,
          ...(club.providerMappings ?? []).map(
            (mapping) => mapping.providerClubName,
          ),
        ],
      })),
    ),
  };
}

export function resolveMappedCanonicalTournamentLogo(
  mappings: readonly ProviderClubIdMappingRow[] | null | undefined,
  context: TournamentLogoResolutionContext,
): string | null {
  const providerClubId = pickProviderClubId(mappings);
  return providerClubId === null
    ? null
    : context.canonicalLogoByProviderClubId.get(providerClubId) ?? null;
}

export function resolveNameMatchedCanonicalTournamentLogo(
  names: readonly (string | null | undefined)[],
  context: TournamentLogoResolutionContext,
): string | null {
  return resolveCanonicalClubLogoByName(
    names,
    context.canonicalLogoByNormalizedClubName,
  );
}

export async function loadTournamentLogoResolutionContext(
  tenantId: string,
): Promise<TournamentLogoResolutionContext> {
  const clubs = await prisma.externalClub.findMany({
    where: {
      tenantId,
      archivedAt: null,
      providerMappings: { some: { provider: SFV_PROVIDER } },
    },
    select: {
      name: true,
      shortName: true,
      alternativeName: true,
      logoUrl: true,
      providerMappings: {
        where: { provider: SFV_PROVIDER },
        select: { providerClubId: true, providerClubName: true },
      },
    },
  });

  return buildTournamentLogoResolutionContext(clubs);
}
