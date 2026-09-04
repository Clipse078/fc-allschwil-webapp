/**
 * lib/tournaments/club-identity.ts
 *
 * TOURNAMENT-LOGOS-01A — canonical club logo resolution for tournaments.
 *
 * Reuses the established SCE logo hierarchy:
 *   - tenant-owned Team participant → Tenant.logoUrl
 *   - ExternalClub participant       → ExternalClub.logoUrl
 *   - ExternalTeam participant (hist.) → team override → club fallback
 *   - manual / unresolved            → null (initials fallback in UI)
 *
 * Organizer resolution:
 *   - canonical ExternalClub match (club directory, tenant-scoped)
 *   - HOME + organizer matches tenant name → tenant logo
 *   - otherwise → null
 *
 * Intentionally small — mirrors lib/matchcenter/club-identity.ts semantics.
 */

import { normalizeClubNameForLookup } from "@/lib/club-directory/club-name-normalization";
import {
  resolveExternalClubLogoUrl,
  resolveExternalTeamCanonicalLogoUrl,
} from "@/lib/club-directory/logo";
import type { TournamentHomeAway } from "./types";
import {
  EMPTY_TOURNAMENT_LOGO_RESOLUTION_CONTEXT,
  resolveMappedCanonicalTournamentLogo,
  resolveNameMatchedCanonicalTournamentLogo,
  type TournamentLogoResolutionContext,
} from "./logo-resolution-context";

export { normalizeClubNameForLookup };

export type TournamentParticipantLogoSource = {
  readonly team: object | null;
  readonly externalClub: {
    readonly name: string;
    readonly shortName?: string | null;
    readonly alternativeName?: string | null;
    readonly logoUrl: string | null;
    readonly providerMappings?: readonly {
      readonly providerClubId: number | null;
    }[];
  } | null;
  readonly externalTeam: {
    readonly name: string;
    readonly shortName?: string | null;
    readonly alternativeName?: string | null;
    readonly logoUrl: string | null;
    readonly providerMappings?: readonly {
      readonly providerClubId: number | null;
    }[];
    readonly externalClub: {
      readonly name: string;
      readonly shortName?: string | null;
      readonly alternativeName?: string | null;
      readonly logoUrl: string | null;
    };
  } | null;
};

export type ResolvedOrganizerClub = {
  readonly id: string;
  readonly logoUrl: string | null;
};

function namesMatchForLookup(left: string, right: string): boolean {
  return normalizeClubNameForLookup(left) === normalizeClubNameForLookup(right);
}

/**
 * Resolves the effective logo URL for one tournament participant row.
 */
export function resolveTournamentParticipantLogoUrl(
  source: TournamentParticipantLogoSource,
  tenantLogoUrl: string | null | undefined,
  context: TournamentLogoResolutionContext =
    EMPTY_TOURNAMENT_LOGO_RESOLUTION_CONTEXT,
): string | null {
  if (source.team) {
    return tenantLogoUrl?.trim() || null;
  }
  if (source.externalClub) {
    const mappedCanonicalLogo = resolveMappedCanonicalTournamentLogo(
      source.externalClub.providerMappings,
      context,
    );
    const nameMatchedCanonicalLogo =
      resolveNameMatchedCanonicalTournamentLogo(
        [
          source.externalClub.name,
          source.externalClub.shortName,
          source.externalClub.alternativeName,
        ],
        context,
      );
    return resolveExternalTeamCanonicalLogoUrl(
      { logoUrl: null },
      source.externalClub,
      { logoUrl: mappedCanonicalLogo },
      { logoUrl: nameMatchedCanonicalLogo },
    );
  }
  if (source.externalTeam) {
    const mappedCanonicalLogo = resolveMappedCanonicalTournamentLogo(
      source.externalTeam.providerMappings,
      context,
    );
    const nameMatchedCanonicalLogo =
      resolveNameMatchedCanonicalTournamentLogo(
        [
          source.externalTeam.externalClub.name,
          source.externalTeam.externalClub.shortName,
          source.externalTeam.externalClub.alternativeName,
          source.externalTeam.name,
          source.externalTeam.shortName,
          source.externalTeam.alternativeName,
        ],
        context,
      );
    return resolveExternalTeamCanonicalLogoUrl(
      source.externalTeam,
      source.externalTeam.externalClub,
      { logoUrl: mappedCanonicalLogo },
      { logoUrl: nameMatchedCanonicalLogo },
    );
  }
  return null;
}

/**
 * Resolves organizer logo + canonical club id from pre-resolved directory data.
 */
export function resolveTournamentOrganizerIdentity(params: {
  readonly organizerName: string | null;
  readonly homeAway: TournamentHomeAway;
  readonly tenantName: string;
  readonly tenantLogoUrl: string | null | undefined;
  readonly resolvedOrganizerClub: ResolvedOrganizerClub | null;
}): {
  readonly logoUrl: string | null;
  readonly externalClubId: string | null;
} {
  const displayName = params.organizerName?.trim();
  if (!displayName) {
    return { logoUrl: null, externalClubId: null };
  }

  if (params.resolvedOrganizerClub) {
    return {
      logoUrl: resolveExternalClubLogoUrl(params.resolvedOrganizerClub),
      externalClubId: params.resolvedOrganizerClub.id,
    };
  }

  if (
    params.homeAway === "HOME" &&
    namesMatchForLookup(displayName, params.tenantName)
  ) {
    return {
      logoUrl: params.tenantLogoUrl?.trim() || null,
      externalClubId: null,
    };
  }

  return { logoUrl: null, externalClubId: null };
}

/**
 * Indexes external clubs by normalized name variants for organizer lookup.
 * Only tenant-scoped clubs should be supplied.
 */
export function buildOrganizerClubLookupIndex(
  clubs: readonly {
    readonly id: string;
    readonly name: string;
    readonly shortName: string | null;
    readonly alternativeName: string | null;
    readonly logoUrl: string | null;
  }[],
): ReadonlyMap<string, ResolvedOrganizerClub> {
  const index = new Map<string, ResolvedOrganizerClub>();

  for (const club of clubs) {
    const resolved: ResolvedOrganizerClub = {
      id: club.id,
      logoUrl: club.logoUrl,
    };
    const names = [club.name, club.shortName, club.alternativeName].filter(
      (value): value is string => Boolean(value?.trim()),
    );
    for (const name of names) {
      index.set(normalizeClubNameForLookup(name), resolved);
    }
  }

  return index;
}

/**
 * Looks up a canonical organizer club from a pre-built index.
 */
export function lookupOrganizerClub(
  organizerName: string | null | undefined,
  index: ReadonlyMap<string, ResolvedOrganizerClub>,
): ResolvedOrganizerClub | null {
  const trimmed = organizerName?.trim();
  if (!trimmed) return null;
  return index.get(normalizeClubNameForLookup(trimmed)) ?? null;
}
