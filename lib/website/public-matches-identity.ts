/**
 * lib/website/public-matches-identity.ts
 *
 * SCE-SPORTING-IDENTITY-01 — batch enrichment of public website matches with
 * canonical matchIdentity. Used by GET /api/public/{tenant}/website/matches.
 */

import { prisma } from "@/lib/db/prisma";
import type { PublicEventItem } from "@/lib/events/public-event-feed";
import {
  collectProviderClubIdsFromEventPolicies,
  loadCanonicalClubLogoIndex,
} from "@/lib/club-directory/canonical-logo-resolution";
import {
  CANONICAL_EVENT_POLICY_SELECT,
  CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
  type CanonicalEventPolicyRow,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import { resolveMatchParticipantIdentity } from "@/lib/sporting-data/match-participant-identity";
import { toPublicWebsiteEvent } from "@/lib/website/public-events-mapper";
import type { PublicWebsiteMatchItem } from "@/lib/website/types";

/** Policy select for match identity — includes team ids for own-side resolution. */
export const PUBLIC_MATCH_IDENTITY_POLICY_SELECT = {
  ...CANONICAL_EVENT_POLICY_SELECT,
  team: {
    select: {
      ...CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
      id: true,
    },
  },
  matchExternalMapping: {
    select: {
      homeTeam: {
        select: {
          ...CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
          id: true,
        },
      },
      awayTeam: {
        select: {
          ...CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
          id: true,
        },
      },
      homeExternalTeam: CANONICAL_EVENT_POLICY_SELECT.matchExternalMapping.select.homeExternalTeam,
      awayExternalTeam: CANONICAL_EVENT_POLICY_SELECT.matchExternalMapping.select.awayExternalTeam,
    },
  },
} as const;

export async function loadMatchEventPoliciesByEventId(
  tenantId: string,
  eventIds: readonly string[],
): Promise<ReadonlyMap<string, CanonicalEventPolicyRow>> {
  const uniqueIds = [...new Set(eventIds)].filter((id) => id.length > 0);
  if (uniqueIds.length === 0) return new Map();

  const rows = await prisma.event.findMany({
    where: { tenantId, id: { in: uniqueIds } },
    select: PUBLIC_MATCH_IDENTITY_POLICY_SELECT,
  });

  return new Map(rows.map((row) => [row.id, row as CanonicalEventPolicyRow]));
}

export type EnrichPublicMatchesInput = {
  tenantId: string;
  tenantName: string;
  events: readonly PublicEventItem[];
};

async function loadTenantLogoUrl(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { logoUrl: true },
  });
  return tenant?.logoUrl ?? null;
}

/**
 * Maps public match events to website DTOs with canonical matchIdentity.
 * Performs batched policy + logo resolution — no per-match ExternalClub queries.
 */
export async function enrichPublicMatchesWithIdentity(
  input: EnrichPublicMatchesInput,
): Promise<PublicWebsiteMatchItem[]> {
  const eventIds = input.events.map((event) => event.id);
  const [policyByEventId, tenantLogoUrl] = await Promise.all([
    loadMatchEventPoliciesByEventId(input.tenantId, eventIds),
    loadTenantLogoUrl(input.tenantId),
  ]);

  const eventPolicies = [...policyByEventId.values()];
  const canonicalLogoByProviderClubId = await loadCanonicalClubLogoIndex(
    input.tenantId,
    collectProviderClubIdsFromEventPolicies(eventPolicies),
  );

  return input.events.map((event) => {
    const base = toPublicWebsiteEvent(event);
    const policy = policyByEventId.get(event.id);

    return {
      ...base,
      matchIdentity: resolveMatchParticipantIdentity(
        policy,
        {
          opponentName: event.opponentName,
          ownTeamDisplayName: event.team?.name ?? null,
        },
        input.tenantName,
        tenantLogoUrl,
        canonicalLogoByProviderClubId,
      ),
    };
  });
}
