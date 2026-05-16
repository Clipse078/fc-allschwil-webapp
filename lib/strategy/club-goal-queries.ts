import { GoalModule } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ClubGoalRow = {
  id: string;
  module: GoalModule;
  templateId: string | null;
  title: string;
  description: string | null;
  metricLabel: string | null;
  metricValue: string | null;
  isActive: boolean;
  teamId: string | null;
  teamName: string | null;
};

export async function getClubGoalsBySeason(
  seasonId: string,
): Promise<ClubGoalRow[]> {
  const rows = await prisma.clubGoal.findMany({
    where: { seasonId },
    orderBy: [{ module: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      module: true,
      templateId: true,
      title: true,
      description: true,
      metricLabel: true,
      metricValue: true,
      isActive: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    ...r,
    teamName: r.team?.name ?? null,
  }));
}

export function groupGoalsByModule(
  goals: ClubGoalRow[],
): Map<GoalModule, ClubGoalRow[]> {
  const map = new Map<GoalModule, ClubGoalRow[]>();
  for (const g of goals) {
    const existing = map.get(g.module) ?? [];
    existing.push(g);
    map.set(g.module, existing);
  }
  return map;
}
