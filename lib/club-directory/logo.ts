/**
 * lib/club-directory/logo.ts
 *
 * CLUB-DIRECTORY-01 — logo resolution and provider-merge rules.
 *
 * Investigation result (see lib/integrations/sfv/client.ts fetchTeamPicture):
 * SFV's "team picture" endpoint is documented as returning the *club* crest
 * keyed by an arbitrary team id belonging to that club ("Fetches the team
 * picture (club logo) for a given team ID" — own teams and opponent teams
 * behave identically). There is no separate club-level picture endpoint.
 * Consequently this module treats the crest as club-level imagery: it is
 * persisted once on ExternalClub.logoUrl and reused by every ExternalTeam
 * under that club unless a team-level override is explicitly set.
 *
 * These are pure functions — no Prisma, no fetch, no side effects — so the
 * "provider sync never overwrites tenant enrichment" and "logo
 * persistence/fallback" rules stay independently testable.
 */

export type LogoSource = {
  logoUrl: string | null | undefined;
};

/**
 * Resolves the effective logo URL for an ExternalTeam: the team-level
 * override when set, otherwise the parent ExternalClub's logo, otherwise
 * null. Callers render a clean placeholder (never a broken <img>) when this
 * returns null.
 */
export function resolveExternalTeamLogoUrl(
  team: LogoSource,
  club: LogoSource,
): string | null {
  return team.logoUrl?.trim() || club.logoUrl?.trim() || null;
}

/**
 * Resolves the effective logo URL for an ExternalTeam with an optional
 * canonical Verein / parent ExternalClub fallback (via providerClubId →
 * ExternalClubProviderMapping). Precedence:
 *   1. team-level override
 *   2. direct parent ExternalClub.logoUrl
 *   3. canonical Verein / mapped parent club logoUrl
 *   4. null (initials fallback in UI)
 */
export function resolveExternalTeamCanonicalLogoUrl(
  team: LogoSource,
  directClub: LogoSource,
  canonicalClub: LogoSource | null | undefined,
): string | null {
  const teamLogo = team.logoUrl?.trim() || null;
  if (teamLogo !== null) return teamLogo;

  const directClubLogo = directClub.logoUrl?.trim() || null;
  if (directClubLogo !== null) return directClubLogo;

  return canonicalClub?.logoUrl?.trim() || null;
}

/**
 * Resolves the effective logo URL for an ExternalClub. Trivial today (no
 * further fallback chain exists above club level) but kept as a named
 * function so consumers never read `.logoUrl` directly and so a future
 * fallback (e.g. a tenant-wide "no logo" asset) can be added in one place.
 */
export function resolveExternalClubLogoUrl(club: LogoSource): string | null {
  return club.logoUrl?.trim() || null;
}

/**
 * Decides the ExternalClub.logoUrl value to persist when a provider sync
 * reports `providerLogoUrl`.
 *
 * Tenant-managed field ownership rule: once a Club Admin (or an earlier
 * sync) has set ExternalClub.logoUrl, provider sync must NEVER overwrite it.
 * The provider-reported crest is only ever used to fill an *empty* slot.
 */
export function mergeProviderLogoUrl(
  currentLogoUrl: string | null | undefined,
  providerLogoUrl: string | null | undefined,
): string | null {
  const current = currentLogoUrl?.trim() || null;
  if (current !== null) {
    return current;
  }
  return providerLogoUrl?.trim() || null;
}
