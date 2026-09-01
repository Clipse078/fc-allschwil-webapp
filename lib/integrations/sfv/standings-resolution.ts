/**
 * lib/integrations/sfv/standings-resolution.ts
 *
 * Canonical standings resolution entry points for Team Cockpit and public API.
 */

import type { SportingStandingsTable } from "@/lib/sporting-data/standings-types";
import {
  fetchTeamStandingsForMapping,
  type FetchTeamStandingsInput,
} from "./standings-provider";
import {
  loadEffectiveTeamStandingsMapping,
  type EffectiveTeamStandingsMapping,
} from "@/lib/teams/team-standings-mapping";

export type ResolveStandingsForMappingInput = FetchTeamStandingsInput & {
  teamSeasonId?: string | null;
};

export type ResolveStandingsForTeamSeasonInput = {
  tenantId: string;
  teamSeasonId: string;
  seasonKey: string;
};

/**
 * Resolves standings when the effective SFV mapping is already known.
 */
export async function resolveStandingsForMapping(
  input: ResolveStandingsForMappingInput,
): Promise<SportingStandingsTable | null> {
  return fetchTeamStandingsForMapping(input);
}

export type ResolvedTeamSeasonStandings = {
  standings: SportingStandingsTable;
  externalTeamId: number;
};

/**
 * Loads the effective TeamSeason mapping and resolves standings through the
 * same canonical provider + durable snapshot path as Team Cockpit.
 */
export async function resolveStandingsForTeamSeason(
  input: ResolveStandingsForTeamSeasonInput,
): Promise<ResolvedTeamSeasonStandings | null> {
  const mapping = await loadEffectiveTeamStandingsMapping(input);
  if (!mapping) {
    return null;
  }

  const standings = await resolveStandingsForMappingFromEffectiveMapping(
    input.tenantId,
    mapping,
    {
      teamSeasonId: input.teamSeasonId,
    },
  );

  if (!standings) {
    return null;
  }

  return {
    standings,
    externalTeamId: mapping.externalTeamId,
  };
}

export function resolveStandingsForMappingFromEffectiveMapping(
  tenantId: string,
  mapping: EffectiveTeamStandingsMapping,
  context?: { teamSeasonId?: string | null },
): Promise<SportingStandingsTable | null> {
  return resolveStandingsForMapping({
    tenantId,
    externalTeamId: mapping.externalTeamId,
    externalSeasonId: mapping.externalSeasonId,
    providerLeagueId: mapping.providerLeagueId,
    teamSeasonId: context?.teamSeasonId ?? null,
  });
}
