/**
 * lib/integrations/sfv/team-season-resolution.ts
 *
 * TEAM-SFV-01B — deterministic TeamSeason resolution for TeamExternalMapping.
 *
 * Resolves tenant + team + provider + externalSeasonId → exactly one
 * TeamSeason, or a typed failure reason. Never resolves by display name.
 */

import { prisma } from "@/lib/db/prisma";
import {
  resolveCanonicalSeasonFromSfvExternalSeasonId,
  SFV_PROVIDER,
} from "./season-bridge";

export type TeamSeasonResolutionFailureReason =
  | "UNSUPPORTED_PROVIDER"
  | "SEASON_NOT_FOUND"
  | "TEAM_NOT_FOUND"
  | "TEAM_TENANT_MISMATCH"
  | "TEAM_SEASON_NOT_FOUND"
  | "AMBIGUOUS";

export type TeamSeasonResolutionResult =
  | {
      ok: true;
      teamSeasonId: string;
      seasonId: string;
      seasonKey: string;
    }
  | {
      ok: false;
      reason: TeamSeasonResolutionFailureReason;
      message: string;
    };

export type ResolveTeamSeasonForMappingInput = {
  tenantId: string;
  teamId: string;
  provider: string;
  externalSeasonId: number;
};

/**
 * Resolves exactly one canonical TeamSeason for a provider mapping.
 *
 * Rules:
 *   - Tenant-scoped via Team.tenantId (mandatory isolation).
 *   - Season resolved from externalSeasonId via season-bridge (not display name).
 *   - Fail closed when zero or multiple TeamSeason rows match.
 */
export async function resolveTeamSeasonForExternalMapping(
  input: ResolveTeamSeasonForMappingInput,
): Promise<TeamSeasonResolutionResult> {
  if (input.provider !== SFV_PROVIDER) {
    return {
      ok: false,
      reason: "UNSUPPORTED_PROVIDER",
      message: `TeamSeason resolution is not implemented for provider "${input.provider}".`,
    };
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, tenantId: true },
  });

  if (!team) {
    return {
      ok: false,
      reason: "TEAM_NOT_FOUND",
      message: "Team nicht gefunden.",
    };
  }

  if (team.tenantId && team.tenantId !== input.tenantId) {
    return {
      ok: false,
      reason: "TEAM_TENANT_MISMATCH",
      message: "Das Team gehört nicht zum Mandanten.",
    };
  }

  const season = await resolveCanonicalSeasonFromSfvExternalSeasonId(
    input.externalSeasonId,
  );

  if (!season) {
    return {
      ok: false,
      reason: "SEASON_NOT_FOUND",
      message: `Keine SCE-Saison für SFV externalSeasonId ${input.externalSeasonId} gefunden.`,
    };
  }

  const teamSeasons = await prisma.teamSeason.findMany({
    where: {
      teamId: input.teamId,
      seasonId: season.id,
    },
    select: { id: true },
  });

  if (teamSeasons.length === 0) {
    return {
      ok: false,
      reason: "TEAM_SEASON_NOT_FOUND",
      message: `Kein TeamSeason für Team und Saison "${season.key}" gefunden.`,
    };
  }

  if (teamSeasons.length > 1) {
    return {
      ok: false,
      reason: "AMBIGUOUS",
      message: `Mehrere TeamSeason-Einträge für Team und Saison "${season.key}" — Verknüpfung abgebrochen.`,
    };
  }

  return {
    ok: true,
    teamSeasonId: teamSeasons[0]!.id,
    seasonId: season.id,
    seasonKey: season.key,
  };
}

/**
 * Convenience wrapper returning only the teamSeasonId when resolution succeeds.
 */
export async function resolveTeamSeasonIdForExternalMapping(
  input: ResolveTeamSeasonForMappingInput,
): Promise<string | null> {
  const result = await resolveTeamSeasonForExternalMapping(input);
  return result.ok ? result.teamSeasonId : null;
}
