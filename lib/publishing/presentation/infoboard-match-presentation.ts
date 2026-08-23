/**
 * lib/publishing/presentation/infoboard-match-presentation.ts
 *
 * INFOBOARD-LOGO-02 — canonical club + team presentation for Screen 1 MATCH cards.
 *
 * Separates club identity (primary line + logo) from team-specific presentation
 * (secondary line) without fragile string parsing as the primary architecture.
 * Reuses canonical Team / ExternalClub / Tenant naming fields supplied by the
 * source loader; legacy combined names are used only as explicit fallbacks.
 *
 * Design constraints:
 *   - Pure, synchronous, deterministic. No I/O, no DB access, no React.
 *   - Blank/whitespace-only strings are treated as absent.
 *   - Never generates placeholders ("TBD", "-", etc.).
 */

import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import type {
  InfoboardMatchPresentation,
  InfoboardMatchSidePresentation,
} from "../event-types";

function meaningful(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Structural identity for one match side, populated by the canonical source
 * loader from Team / ExternalTeam / ExternalClub / Tenant records.
 */
export type InfoboardMatchSideIdentity = {
  readonly isOwnTeam: boolean;
  readonly clubName: string | null;
  readonly clubLogoUrl: string | null;
  readonly teamName: string | null;
  readonly teamShortName: string | null;
  readonly teamAlternativeName: string | null;
  /** Legacy combined display name when canonical club/team split is unavailable. */
  readonly fallbackDisplayName: string | null;
};

export type InfoboardMatchIdentity = {
  readonly home: InfoboardMatchSideIdentity;
  readonly away: InfoboardMatchSideIdentity | null;
};

/**
 * Resolves the primary club display line for one match side.
 *
 * Uses canonical club identity when available; otherwise falls back to the
 * legacy combined display name supplied by the feed mapper.
 */
export function resolveInfoboardClubDisplayName(
  clubName: string | null | undefined,
  fallbackDisplayName: string | null | undefined,
): string {
  return (
    meaningful(clubName) ??
    meaningful(fallbackDisplayName) ??
    ""
  );
}

/**
 * Resolves the secondary team-specific line for one match side.
 *
 * Priority (tenant Team naming architecture):
 *   1. alternativeName
 *   2. shortName
 *   3. name — only when it does not merely repeat the club line
 */
export function resolveInfoboardTeamSubDisplayName(input: {
  readonly clubDisplayName: string;
  readonly teamName: string | null | undefined;
  readonly teamShortName: string | null | undefined;
  readonly teamAlternativeName: string | null | undefined;
}): string | null {
  const alternative = meaningful(input.teamAlternativeName);
  if (alternative) return alternative;

  const short = meaningful(input.teamShortName);
  if (short) return short;

  const name = meaningful(input.teamName);
  if (!name) return null;

  const club = meaningful(input.clubDisplayName);
  if (!club) return name;

  if (name.toUpperCase() === club.toUpperCase()) return null;

  const clubUpper = club.toUpperCase();
  const nameUpper = name.toUpperCase();
  if (nameUpper.startsWith(clubUpper)) {
    const stripped = name.slice(club.length).trim();
    if (stripped.length > 0) return stripped;
    return null;
  }

  return name;
}

function resolveSidePresentation(
  identity: InfoboardMatchSideIdentity,
  tenantLogoUrl: string | null | undefined,
): InfoboardMatchSidePresentation {
  const clubDisplayName = resolveInfoboardClubDisplayName(
    identity.clubName,
    identity.fallbackDisplayName,
  );

  const teamSubDisplayName = resolveInfoboardTeamSubDisplayName({
    clubDisplayName,
    teamName: identity.teamName,
    teamShortName: identity.teamShortName,
    teamAlternativeName: identity.teamAlternativeName,
  });

  const clubLogoUrl = resolveClubIdentityLogoUrl(
    {
      isOwnTeam: identity.isOwnTeam,
      externalLogoUrl: identity.clubLogoUrl,
    },
    tenantLogoUrl,
  );

  return {
    clubDisplayName,
    teamSubDisplayName,
    clubLogoUrl,
  };
}

export function enrichMatchIdentityWithTenant(
  identity: InfoboardMatchIdentity,
  tenantClubName: string,
): InfoboardMatchIdentity {
  const patchSide = (
    side: InfoboardMatchIdentity["home"],
  ): InfoboardMatchIdentity["home"] => {
    if (!side.isOwnTeam) return side;
    return {
      ...side,
      clubName: side.clubName ?? tenantClubName,
    };
  };

  return {
    home: patchSide(identity.home),
    away: identity.away != null ? patchSide(identity.away) : null,
  };
}

/**
 * Builds the full MATCH presentation block for Screen 1 from canonical side
 * identities and tenant branding context.
 */
export function resolveInfoboardMatchPresentation(
  identity: InfoboardMatchIdentity | null | undefined,
  tenantLogoUrl: string | null | undefined,
  tenantClubName?: string | null,
): InfoboardMatchPresentation | null {
  if (identity == null) return null;

  const enriched =
    tenantClubName != null && tenantClubName.trim().length > 0
      ? enrichMatchIdentityWithTenant(identity, tenantClubName.trim())
      : identity;

  return {
    home: resolveSidePresentation(enriched.home, tenantLogoUrl),
    away:
      enriched.away != null
        ? resolveSidePresentation(enriched.away, tenantLogoUrl)
        : null,
  };
}
