/**
 * lib/teams/team-season-standings-capability.ts
 *
 * Canonical, configuration-based standings availability for a TeamSeason.
 *
 * Distinction:
 *   - configured for league standings (stable metadata)
 *   - live SFV standings rows returned on a single request (volatile)
 *
 * Public website selectors and admin cockpit Rangliste both use this signal
 * instead of fan-out live standings fetches.
 */

import { prisma } from "@/lib/db/prisma";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import {
  resolveCurrentSeasonSfvMapping,
  type CurrentSeasonSfvMappingRecord,
} from "@/lib/teams/team-competition-display";
import {
  mapCurrentSeasonSfvMapping,
  type LoadCurrentSeasonSfvMappingsForListInput,
} from "@/lib/teams/team-cockpit-sporting-data";

const standingsCapabilityMappingSelect = {
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

export type TeamSeasonStandingsCapabilityInput = {
  readonly teamSeasonId: string;
  readonly seasonKey: string;
};

/**
 * Returns true when the TeamSeason has a season-aligned active SFV mapping
 * that represents a league standings competition assignment.
 *
 * Mirrors Team Cockpit Rangliste `hasProviderMapping`, but excludes teams
 * without a provider league assignment (for example Kinderfussball training
 * groups that may still have an SFV team link but no league table).
 */
export function resolveTeamSeasonHasStandings(
  mapping: CurrentSeasonSfvMappingRecord | null | undefined,
  input: TeamSeasonStandingsCapabilityInput,
): boolean {
  const seasonSafeMapping = resolveCurrentSeasonSfvMapping(mapping, input);
  if (!seasonSafeMapping) {
    return false;
  }

  return seasonSafeMapping.providerLeagueId != null;
}

/**
 * Batch loader for public teams / list surfaces.
 * One DB query for all TeamSeason ids — no live standings fan-out.
 */
export async function loadTeamSeasonHasStandingsForList(
  input: LoadCurrentSeasonSfvMappingsForListInput,
): Promise<Map<string, boolean>> {
  const teamSeasonIds = input.entries.map((entry) => entry.teamSeasonId);
  const result = new Map<string, boolean>();

  if (teamSeasonIds.length === 0) {
    return result;
  }

  const mappings = await prisma.teamExternalMapping.findMany({
    where: {
      tenantId: input.tenantId,
      teamSeasonId: { in: teamSeasonIds },
      provider: SFV_PROVIDER,
      providerIsActive: true,
    },
    select: standingsCapabilityMappingSelect,
  });

  const mappingsByTeamSeasonId = new Map(
    mappings
      .filter(
        (mapping): mapping is typeof mapping & { teamSeasonId: string } =>
          mapping.teamSeasonId !== null,
      )
      .map((mapping) => [mapping.teamSeasonId, mapping]),
  );

  for (const entry of input.entries) {
    const mapping = mapCurrentSeasonSfvMapping(
      mappingsByTeamSeasonId.get(entry.teamSeasonId) ?? null,
      {
        tenantId: input.tenantId,
        teamSeasonId: entry.teamSeasonId,
        seasonKey: entry.seasonKey,
      },
    );

    result.set(
      entry.teamSeasonId,
      mapping != null && mapping.providerLeagueId != null,
    );
  }

  return result;
}
