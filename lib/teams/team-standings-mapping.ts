/**
 * Canonical effective SFV mapping resolution for TeamSeason standings.
 *
 * Every standings surface must use this module so tenant, provider, active,
 * TeamSeason, and season constraints cannot drift between cockpit and public
 * reads.
 */

import { prisma } from "@/lib/db/prisma";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import { resolveCurrentSeasonSfvMapping } from "@/lib/teams/team-competition-display";

export type EffectiveTeamStandingsMapping = {
  readonly externalTeamId: number;
  readonly externalSeasonId: number;
  readonly providerLeagueId: number;
  readonly providerLeagueName: string | null;
  readonly providerTeamName: string | null;
  readonly lastSyncedAt: Date;
};

export type EffectiveTeamStandingsMappingRecord = {
  readonly externalTeamId: number;
  readonly externalSeasonId: number;
  readonly providerLeagueId: number | null;
  readonly providerLeagueName: string | null;
  readonly providerTeamName: string | null;
  readonly lastSyncedAt: Date;
  readonly teamSeasonId: string | null;
  readonly provider: string;
  readonly providerIsActive: boolean;
};

export type ResolveEffectiveTeamStandingsMappingInput = {
  readonly teamSeasonId: string;
  readonly seasonKey: string;
};

export const effectiveTeamStandingsMappingSelect = {
  externalTeamId: true,
  externalSeasonId: true,
  providerLeagueId: true,
  providerLeagueName: true,
  providerTeamName: true,
  lastSyncedAt: true,
  teamSeasonId: true,
  provider: true,
  providerIsActive: true,
} as const;

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Resolves the one mapping that Team Cockpit and public standings may fetch.
 * Invalid provider records fail closed before any provider request is made.
 */
export function resolveEffectiveTeamStandingsMapping(
  mapping: EffectiveTeamStandingsMappingRecord | null | undefined,
  input: ResolveEffectiveTeamStandingsMappingInput,
): EffectiveTeamStandingsMapping | null {
  if (
    !mapping ||
    mapping.provider !== SFV_PROVIDER ||
    !mapping.providerIsActive ||
    !isPositiveInteger(mapping.externalTeamId) ||
    !isPositiveInteger(mapping.externalSeasonId) ||
    mapping.providerLeagueId == null ||
    !isPositiveInteger(mapping.providerLeagueId) ||
    !mapping.providerLeagueName?.trim()
  ) {
    return null;
  }

  const seasonSafeMapping = resolveCurrentSeasonSfvMapping(mapping, input);
  if (!seasonSafeMapping) {
    return null;
  }

  return {
    externalTeamId: mapping.externalTeamId,
    externalSeasonId: mapping.externalSeasonId,
    providerLeagueId: mapping.providerLeagueId,
    providerLeagueName: mapping.providerLeagueName,
    providerTeamName: mapping.providerTeamName,
    lastSyncedAt: mapping.lastSyncedAt,
  };
}

/**
 * Stable configuration capability for selectors. This deliberately does not
 * call SFV: a temporary provider failure must not remove a configured team.
 */
export function isEffectiveMappingStandingsCapable(
  mapping: EffectiveTeamStandingsMapping | null | undefined,
): boolean {
  return mapping != null;
}

export async function loadEffectiveTeamStandingsMapping(input: {
  readonly tenantId: string;
  readonly teamSeasonId: string;
  readonly seasonKey: string;
}): Promise<EffectiveTeamStandingsMapping | null> {
  const mapping = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId: input.tenantId,
      teamSeasonId: input.teamSeasonId,
      provider: SFV_PROVIDER,
      providerIsActive: true,
    },
    select: effectiveTeamStandingsMappingSelect,
  });

  return resolveEffectiveTeamStandingsMapping(mapping, input);
}
