/**
 * lib/training/team-season-eligibility.ts
 *
 * TRAINING-SERIES-PREMIUM-01 — canonical TeamSeason eligibility for
 * TrainingSeries creation.
 *
 * Root cause (Seniorinnen / competition-less teams missing from
 * /dashboard/training/new): findTeamSeasonsForTenant previously required
 * `TeamSeason.status === "ACTIVE"`, while the Teams module (getTeamsListData)
 * scopes only by current season — it never filters TeamSeason.status.
 * Training-only / competition-less teams such as Seniorinnen can legitimately
 * carry an INACTIVE TeamSeason status while still being the canonical current
 * season row shown in Teams. createTrainingSeries() itself only rejects
 * archived Teams (team.isActive === false) — not TeamSeason.status — so the
 * picker was strictly MORE restrictive than the service layer.
 *
 * Canonical rule (aligned with Teams management + createTrainingSeries):
 *   - same tenant
 *   - Team.isActive === true (archived teams excluded)
 *   - TeamSeason belongs to the canonical current Season
 *   - TeamSeason.status !== ARCHIVED
 *   - competition / SFV mapping NOT required
 */

import type { Prisma } from "@prisma/client";
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";

/** Prisma `where` fragment for eligible TeamSeason rows in TrainingCenter pickers. */
export function trainingSeriesTeamSeasonEligibilityWhere(
  tenantId: string,
): Prisma.TeamSeasonWhereInput {
  return {
    NOT: { status: "ARCHIVED" },
    team: { tenantId, isActive: true },
    ...currentTeamSeasonWhere(),
  };
}
