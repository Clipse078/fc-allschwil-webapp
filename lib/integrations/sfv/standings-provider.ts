/**
 * lib/integrations/sfv/standings-provider.ts
 *
 * SFV standings provider with tenant-scoped club resolution and read-through cache.
 */

import type { SportingStandingsTable } from "@/lib/sporting-data/standings-types";
import { fetchClubRanking } from "./client";
import {
  buildStandingsCacheKey,
  getCachedStandingsEntries,
  setCachedStandingsEntries,
} from "./standings-cache";
import { resolveStandingsTable } from "./standings-table";
import {
  isSfvEnabledForTenant,
  requireEnabledSfvConfigForTenant,
} from "./tenant-config-service";

export type FetchTeamStandingsInput = {
  tenantId: string;
  externalTeamId: number;
  externalSeasonId: number;
  providerLeagueId?: number | null;
};

/**
 * Fetches the authoritative standings table for a mapped SFV team.
 *
 * ClubId is always resolved from tenant configuration — never caller-supplied.
 * Returns null on any configuration, provider, or resolution failure.
 */
export async function fetchTeamStandingsForMapping(
  input: FetchTeamStandingsInput,
): Promise<SportingStandingsTable | null> {
  if (
    !Number.isInteger(input.externalTeamId) ||
    input.externalTeamId <= 0 ||
    !Number.isInteger(input.externalSeasonId) ||
    input.externalSeasonId <= 0
  ) {
    return null;
  }

  const enabled = await isSfvEnabledForTenant(input.tenantId);
  if (!enabled) {
    return null;
  }

  try {
    const config = await requireEnabledSfvConfigForTenant(input.tenantId);
    const cacheKey = buildStandingsCacheKey(input.tenantId, input.externalSeasonId);

    let entries = getCachedStandingsEntries(cacheKey);
    if (!entries) {
      entries = await fetchClubRanking({
        SeasonId: input.externalSeasonId,
        ClubId: config.clubId,
        ...(config.organisationId !== null
          ? { OrganisationId: config.organisationId }
          : {}),
      });
      setCachedStandingsEntries(cacheKey, entries);
    }

    return resolveStandingsTable({
      entries,
      externalTeamId: input.externalTeamId,
      providerLeagueId: input.providerLeagueId,
    });
  } catch {
    return null;
  }
}
