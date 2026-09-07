/**
 * lib/sporting-data/match-participant-identity.ts
 *
 * SCE-SPORTING-IDENTITY-01 — canonical match participant identity resolver.
 *
 * Single domain-level resolver for HOME/AWAY participant identity used by
 * public website matches, weekplan, and other sporting serializers.
 *
 * Preserves provider data 1:1 — identity presentation only; no score/state
 * mutation or invented logos.
 */

import { resolveExternalClubLogoUrl } from "@/lib/club-directory/logo";
import { resolveExternalTeamLogoWithCanonicalFallback } from "@/lib/club-directory/canonical-logo-resolution";
import type { CanonicalEventPolicyRow, CanonicalInfoboardTeamDisplayNameRow } from "@/lib/publishing/infoboard/canonical-source-loader";
import { resolveLongTeamName } from "@/lib/teams/team-naming";
import type {
  PublicWochenplanClubIdentity,
  PublicWochenplanMatchIdentity,
} from "@/lib/website/types";

export type MatchParticipantIdentityContext = {
  /** Event.opponentName — provider/opponent fallback label. */
  readonly opponentName: string | null;
  /** Tenant team display name fallback (Event.team.name or season display). */
  readonly ownTeamDisplayName: string | null;
};

function meaningful(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type TeamWithOptionalId = CanonicalInfoboardTeamDisplayNameRow & { id?: string };

type ExternalTeamPolicyRow = NonNullable<
  NonNullable<CanonicalEventPolicyRow["matchExternalMapping"]>["awayExternalTeam"]
>;

type ExternalClubPolicyRow = NonNullable<CanonicalEventPolicyRow["opponentExternalClub"]>;

function buildOwnClubIdentity(
  team: TeamWithOptionalId | null | undefined,
  tenantClubName: string,
  tenantLogoUrl: string | null,
  fallbackDisplayName: string | null,
  teamSeasonDisplayName?: string | null,
): PublicWochenplanClubIdentity {
  const resolvedTeamName = team
    ? resolveLongTeamName({
        teamName: team.name,
        teamShortName: team.shortName,
        teamAlternativeName: team.alternativeName,
        teamSeasonDisplayName,
      })
    : null;

  return {
    displayName:
      meaningful(resolvedTeamName) ??
      meaningful(team?.name) ??
      meaningful(fallbackDisplayName) ??
      tenantClubName,
    logoUrl: tenantLogoUrl,
    teamId: team?.id ?? null,
    externalClubId: null,
  };
}

function buildExternalClubIdentity(
  externalClub: ExternalClubPolicyRow,
  fallbackDisplayName: string | null,
): PublicWochenplanClubIdentity {
  return {
    displayName: meaningful(externalClub.name) ?? meaningful(fallbackDisplayName) ?? "",
    logoUrl: resolveExternalClubLogoUrl(externalClub),
    teamId: null,
    externalClubId: null,
  };
}

function buildExternalTeamIdentity(
  externalTeam: ExternalTeamPolicyRow | null,
  fallbackDisplayName: string | null,
  canonicalLogoByProviderClubId: ReadonlyMap<number, string | null>,
): PublicWochenplanClubIdentity {
  if (!externalTeam) {
    return {
      displayName: meaningful(fallbackDisplayName) ?? "",
      logoUrl: null,
      teamId: null,
      externalClubId: null,
    };
  }

  return {
    displayName:
      meaningful(externalTeam.name) ??
      meaningful(externalTeam.externalClub.name) ??
      meaningful(fallbackDisplayName) ??
      "",
    logoUrl: resolveExternalTeamLogoWithCanonicalFallback(
      {
        team: externalTeam,
        directClub: externalTeam.externalClub,
        providerMappings: externalTeam.providerMappings,
      },
      canonicalLogoByProviderClubId,
    ),
    teamId: null,
    externalClubId: null,
  };
}

/**
 * Resolves canonical HOME/AWAY participant identity for one match event.
 */
export function resolveMatchParticipantIdentity(
  policy: CanonicalEventPolicyRow | undefined,
  context: MatchParticipantIdentityContext,
  tenantClubName: string,
  tenantLogoUrl: string | null,
  canonicalLogoByProviderClubId: ReadonlyMap<number, string | null> = new Map(),
): PublicWochenplanMatchIdentity {
  const mapping = policy?.matchExternalMapping ?? null;
  const eventTeam = policy?.team ?? null;
  const homeAway = (policy?.homeAway ?? "HOME").trim().toUpperCase();
  const ownTeamIsAway = homeAway === "AWAY";
  const ownTeamFallback = context.ownTeamDisplayName;
  const opponentFallback = context.opponentName;

  if (mapping) {
    return {
      home: mapping.homeTeam
        ? buildOwnClubIdentity(
            mapping.homeTeam as TeamWithOptionalId,
            tenantClubName,
            tenantLogoUrl,
            ownTeamIsAway ? opponentFallback : ownTeamFallback,
          )
        : buildExternalTeamIdentity(
            mapping.homeExternalTeam,
            ownTeamIsAway ? opponentFallback : ownTeamFallback,
            canonicalLogoByProviderClubId,
          ),
      away: mapping.awayTeam
        ? buildOwnClubIdentity(
            mapping.awayTeam as TeamWithOptionalId,
            tenantClubName,
            tenantLogoUrl,
            ownTeamIsAway ? ownTeamFallback : opponentFallback,
          )
        : buildExternalTeamIdentity(
            mapping.awayExternalTeam,
            ownTeamIsAway ? ownTeamFallback : opponentFallback,
            canonicalLogoByProviderClubId,
          ),
    };
  }

  const opponentClub = policy?.opponentExternalClub ?? null;

  if (ownTeamIsAway) {
    return {
      home: opponentClub
        ? buildExternalClubIdentity(opponentClub, opponentFallback)
        : buildExternalTeamIdentity(null, opponentFallback, canonicalLogoByProviderClubId),
      away: buildOwnClubIdentity(
        eventTeam as TeamWithOptionalId,
        tenantClubName,
        tenantLogoUrl,
        ownTeamFallback,
      ),
    };
  }

  return {
    home: buildOwnClubIdentity(
      eventTeam as TeamWithOptionalId,
      tenantClubName,
      tenantLogoUrl,
      ownTeamFallback,
    ),
    away: opponentClub
      ? buildExternalClubIdentity(opponentClub, opponentFallback)
      : buildExternalTeamIdentity(null, opponentFallback, canonicalLogoByProviderClubId),
  };
}
