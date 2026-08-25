/**
 * lib/sporting-data/season-scope.ts
 *
 * TEAM-SFV-02B — tenant + team + season isolation helpers.
 */

import { getCanonicalSeasonKeyFromSfvExternalSeasonId } from "@/lib/integrations/sfv/season-bridge";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import type { SportingSeasonScope } from "./types";

export type ResolvedSportingSeasonScope = {
  tenantId: string;
  seasonId: string;
  seasonKey: string | null;
  teamId: string | null;
  teamSeasonId: string | null;
};

export type SeasonScopeDatabase = {
  teamSeason: {
    findFirst(args: object): Promise<{
      id: string;
      teamId: string;
      seasonId: string;
      team: { tenantId: string | null };
      season: { id: string; key: string };
    } | null>;
  };
  season: {
    findFirst(args: object): Promise<{ id: string; key: string } | null>;
    findUnique(args: object): Promise<{ id: string; key: string } | null>;
  };
};

function requireIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

/**
 * Resolves the canonical season/team scope for sporting-match queries.
 *
 * Fail-closed: throws when teamSeasonId or seasonKey cannot be resolved within
 * the tenant.
 */
export async function resolveSportingSeasonScope(
  database: SeasonScopeDatabase,
  input: {
    tenantId: string;
    teamId?: string;
    teamSeasonId?: string;
    seasonId?: string;
    seasonKey?: string;
  },
): Promise<ResolvedSportingSeasonScope> {
  const tenantId = requireIdentifier(input.tenantId, "tenantId");

  if (input.teamSeasonId) {
    const teamSeasonId = requireIdentifier(input.teamSeasonId, "teamSeasonId");
    const teamSeason = await database.teamSeason.findFirst({
      where: {
        id: teamSeasonId,
        team: { tenantId },
      },
      select: {
        id: true,
        teamId: true,
        seasonId: true,
        team: { select: { tenantId: true } },
        season: { select: { id: true, key: true } },
      },
    });

    if (!teamSeason) {
      throw new Error(
        `TeamSeason ${teamSeasonId} was not found for tenant ${tenantId}.`,
      );
    }

    if (input.teamId && input.teamId !== teamSeason.teamId) {
      throw new Error("teamId does not match the provided teamSeasonId.");
    }

    if (input.seasonId && input.seasonId !== teamSeason.seasonId) {
      throw new Error("seasonId does not match the provided teamSeasonId.");
    }

    return {
      tenantId,
      seasonId: teamSeason.seasonId,
      seasonKey: teamSeason.season.key,
      teamId: teamSeason.teamId,
      teamSeasonId: teamSeason.id,
    };
  }

  let seasonId = input.seasonId?.trim() || null;
  let seasonKey = input.seasonKey?.trim() || null;

  if (!seasonId && seasonKey) {
    const season = await database.season.findUnique({
      where: { key: seasonKey },
      select: { id: true, key: true },
    });

    if (!season) {
      throw new Error(`Season with key "${seasonKey}" was not found.`);
    }

    seasonId = season.id;
    seasonKey = season.key;
  }

  if (!seasonId) {
    const activeSeason = await database.season.findFirst({
      where: { isActive: true },
      select: { id: true, key: true },
    });

    if (!activeSeason) {
      throw new Error("No active season is configured.");
    }

    seasonId = activeSeason.id;
    seasonKey = activeSeason.key;
  }

  if (!seasonKey) {
    const season = await database.season.findUnique({
      where: { id: seasonId },
      select: { id: true, key: true },
    });
    seasonKey = season?.key ?? null;
  }

  if (input.teamId) {
    requireIdentifier(input.teamId, "teamId");
  }

  return {
    tenantId,
    seasonId,
    seasonKey,
    teamId: input.teamId?.trim() || null,
    teamSeasonId: null,
  };
}

function externalSeasonKey(
  externalSeasonId: number | null | undefined,
): string | null {
  if (externalSeasonId == null) {
    return null;
  }

  try {
    return getCanonicalSeasonKeyFromSfvExternalSeasonId(externalSeasonId);
  } catch {
    return null;
  }
}

/**
 * Pure post-query guard ensuring team + tenant + season all agree.
 */
export function matchBelongsToSeasonScope(
  match: Pick<
    MatchcenterMatchSummary,
    "tenantId" | "teamId" | "seasonId" | "source"
  >,
  scope: SportingSeasonScope,
): boolean {
  if (match.tenantId !== scope.tenantId) {
    return false;
  }

  if (scope.teamId && match.teamId !== scope.teamId) {
    return false;
  }

  if (match.seasonId && match.seasonId !== scope.seasonId) {
    return false;
  }

  const providerSeasonKey = externalSeasonKey(match.source.externalSeasonId);
  if (
    providerSeasonKey &&
    scope.seasonKey &&
    providerSeasonKey !== scope.seasonKey
  ) {
    return false;
  }

  return true;
}
