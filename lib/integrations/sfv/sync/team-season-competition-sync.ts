/**
 * lib/integrations/sfv/sync/team-season-competition-sync.ts
 *
 * TEAM-SFV-01B — links synced SFV competitions to TeamSeasonCompetition rows.
 *
 * After Competition rows are synced from the SFV team list, this module
 * deterministically associates each mapped club team with its league
 * competition for the resolved TeamSeason.
 *
 * Identity is provider-safe and season-safe:
 *   tenantId + provider + externalCompetitionId + externalSeasonId
 */

import { prisma } from "@/lib/db/prisma";
import type { TeamDetail } from "../client";
import { SFV_PROVIDER } from "../season-bridge";
import { resolveTeamSeasonIdForExternalMapping } from "../team-season-resolution";

export type TeamCompetitionLinkContext = {
  tenantId: string;
  externalSeasonId: number;
  externalTeamId: number;
  externalCompetitionId: number;
  providerLeagueId: number | null;
};

export type TeamSeasonCompetitionLinkOutcome =
  | { status: "linked"; teamSeasonId: string; competitionId: string; isPrimary: boolean }
  | { status: "skipped"; reason: string }
  | { status: "failed"; code: string; message: string };

/**
 * Builds per-team competition contexts from an SFV team list.
 *
 * One team may only appear once in the team list, but multiple teams may
 * share a league. Each team retains its own providerLeagueId for primary
 * selection.
 */
export function buildTeamCompetitionLinkContextsFromTeamList(
  teams: readonly TeamDetail[],
  externalSeasonId: number,
): TeamCompetitionLinkContext[] {
  const contexts: TeamCompetitionLinkContext[] = [];

  for (const team of teams) {
    const leagueId = team.teamLeagueId;
    if (!leagueId || leagueId === 0) {
      continue;
    }

    contexts.push({
      tenantId: "",
      externalSeasonId,
      externalTeamId: team.teamId,
      externalCompetitionId: leagueId,
      providerLeagueId: leagueId,
    });
  }

  return contexts;
}

/**
 * Deterministic primary competition selection among linked competitions.
 *
 * Prefers the competition matching providerLeagueId; ties broken by lowest
 * externalCompetitionId.
 */
export function selectPrimaryCompetitionId(
  competitionIds: readonly string[],
  contexts: readonly TeamCompetitionLinkContext[],
  competitionExternalIds: ReadonlyMap<string, number>,
  providerLeagueId: number | null,
): string | null {
  if (competitionIds.length === 0) {
    return null;
  }

  const preferred =
    providerLeagueId !== null
      ? competitionIds.filter(
          (id) => competitionExternalIds.get(id) === providerLeagueId,
        )
      : [];

  const candidates = preferred.length > 0 ? preferred : [...competitionIds];

  candidates.sort((a, b) => {
    const extA = competitionExternalIds.get(a) ?? Number.MAX_SAFE_INTEGER;
    const extB = competitionExternalIds.get(b) ?? Number.MAX_SAFE_INTEGER;
    return extA - extB || a.localeCompare(b);
  });

  return candidates[0] ?? null;
}

/**
 * Links one mapped SFV team to its Competition via TeamSeasonCompetition.
 *
 * Does not mutate mappings. Requires an existing Competition row and a
 * resolvable TeamSeason (via mapping.teamSeasonId or deterministic resolution).
 */
export async function linkTeamSeasonCompetitionFromSync(
  tenantId: string,
  context: Omit<TeamCompetitionLinkContext, "tenantId">,
): Promise<TeamSeasonCompetitionLinkOutcome> {
  const mapping = await prisma.teamExternalMapping.findFirst({
    where: {
      tenantId,
      provider: SFV_PROVIDER,
      externalTeamId: context.externalTeamId,
      externalSeasonId: context.externalSeasonId,
    },
    select: {
      id: true,
      teamId: true,
      teamSeasonId: true,
      providerLeagueId: true,
    },
  });

  if (!mapping) {
    return {
      status: "skipped",
      reason: "NO_MAPPING",
    };
  }

  let teamSeasonId = mapping.teamSeasonId;

  if (teamSeasonId === null) {
    teamSeasonId = await resolveTeamSeasonIdForExternalMapping({
      tenantId,
      teamId: mapping.teamId,
      provider: SFV_PROVIDER,
      externalSeasonId: context.externalSeasonId,
    });
  }

  if (teamSeasonId === null) {
    return {
      status: "skipped",
      reason: "TEAM_SEASON_UNRESOLVED",
    };
  }

  const competition = await prisma.competition.findFirst({
    where: {
      tenantId,
      provider: SFV_PROVIDER,
      externalCompetitionId: context.externalCompetitionId,
      externalSeasonId: context.externalSeasonId,
      isArchived: false,
    },
    select: { id: true, externalCompetitionId: true },
  });

  if (!competition) {
    return {
      status: "skipped",
      reason: "COMPETITION_NOT_FOUND",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.teamSeasonCompetition.findUnique({
        where: {
          teamSeasonId_competitionId: {
            teamSeasonId,
            competitionId: competition.id,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        await tx.teamSeasonCompetition.create({
          data: {
            teamSeasonId,
            competitionId: competition.id,
            isPrimary: false,
            displayOrder: context.externalCompetitionId,
          },
        });
      }

      const linked = await tx.teamSeasonCompetition.findMany({
        where: { teamSeasonId },
        select: {
          id: true,
          competitionId: true,
          competition: { select: { externalCompetitionId: true } },
        },
      });

      const externalIdMap = new Map<string, number>();
      for (const row of linked) {
        if (row.competition.externalCompetitionId !== null) {
          externalIdMap.set(row.competitionId, row.competition.externalCompetitionId);
        }
      }

      const primaryId = selectPrimaryCompetitionId(
        linked.map((row) => row.competitionId),
        [
          {
            tenantId,
            externalSeasonId: context.externalSeasonId,
            externalTeamId: context.externalTeamId,
            externalCompetitionId: context.externalCompetitionId,
            providerLeagueId: mapping.providerLeagueId,
          },
        ],
        externalIdMap,
        mapping.providerLeagueId,
      );

      await tx.teamSeasonCompetition.updateMany({
        where: { teamSeasonId, isPrimary: true },
        data: { isPrimary: false },
      });

      if (primaryId) {
        await tx.teamSeasonCompetition.updateMany({
          where: { teamSeasonId, competitionId: primaryId },
          data: { isPrimary: true, displayOrder: 0 },
        });
      }
    });

    const primary =
      (await prisma.teamSeasonCompetition.findFirst({
        where: {
          teamSeasonId,
          competitionId: competition.id,
        },
        select: { isPrimary: true },
      }))?.isPrimary ?? false;

    return {
      status: "linked",
      teamSeasonId,
      competitionId: competition.id,
      isPrimary: primary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "failed",
      code: "TEAM_SEASON_COMPETITION_LINK_FAILED",
      message,
    };
  }
}

export type TeamSeasonCompetitionSyncSummary = {
  linked: number;
  skipped: number;
  failed: number;
  errors: Array<{ externalTeamId: number; code: string; message: string }>;
};

/**
 * Links TeamSeasonCompetition rows for all mapped teams in an SFV team list.
 *
 * Intended to run after Competition sync within the same orchestrator.
 */
export async function syncTeamSeasonCompetitionsFromTeamList(
  tenantId: string,
  teams: readonly TeamDetail[],
  externalSeasonId: number,
): Promise<TeamSeasonCompetitionSyncSummary> {
  const contexts = buildTeamCompetitionLinkContextsFromTeamList(
    teams,
    externalSeasonId,
  );

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  const errors: TeamSeasonCompetitionSyncSummary["errors"] = [];

  for (const context of contexts) {
    const outcome = await linkTeamSeasonCompetitionFromSync(tenantId, context);

    switch (outcome.status) {
      case "linked":
        linked++;
        break;
      case "skipped":
        skipped++;
        break;
      case "failed":
        failed++;
        errors.push({
          externalTeamId: context.externalTeamId,
          code: outcome.code,
          message: outcome.message,
        });
        break;
    }
  }

  return { linked, skipped, failed, errors };
}
