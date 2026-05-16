import { TrainingFocus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  TECHNICAL: "Technik",
  TACTICAL: "Taktik",
  PHYSICAL: "Kondition",
  MENTAL: "Mental",
  GOALKEEPING: "Torhüter",
  OTHER: "Sonstiges",
};

export type TrainingBlockRow = {
  focus: TrainingFocus;
  focusLabel: string;
  count: number;
  actualPct: number;
  targetPct: number | null;
  delta: number | null;
};

export type TrainingBlocksVsTargets = {
  rows: TrainingBlockRow[];
  totalTrainings: number;
  hasTargets: boolean;
};

export async function getTrainingBlocksVsTargets(
  seasonId: string,
  teamId?: string | null,
): Promise<TrainingBlocksVsTargets> {
  const [trainings, targets] = await Promise.all([
    prisma.event.findMany({
      where: {
        seasonId,
        type: "TRAINING",
        trainingFocus: { not: null },
        ...(teamId ? { teamId } : {}),
      },
      select: { trainingFocus: true },
    }),
    prisma.strategyTarget.findMany({
      where: {
        seasonId,
        teamId: teamId ?? null,
      },
      select: { focus: true, targetPct: true },
    }),
  ]);

  const totalTrainings = trainings.length;
  const targetMap = new Map(targets.map((t) => [t.focus, t.targetPct]));

  const countMap = new Map<TrainingFocus, number>();
  for (const t of trainings) {
    if (t.trainingFocus) {
      countMap.set(t.trainingFocus, (countMap.get(t.trainingFocus) ?? 0) + 1);
    }
  }

  const allFocuses = new Set<TrainingFocus>([
    ...countMap.keys(),
    ...targetMap.keys(),
  ]);

  const rows: TrainingBlockRow[] = [...allFocuses]
    .sort()
    .map((focus) => {
      const count = countMap.get(focus) ?? 0;
      const actualPct =
        totalTrainings > 0 ? Math.round((count / totalTrainings) * 100) : 0;
      const targetPct = targetMap.get(focus) ?? null;
      const delta = targetPct !== null ? actualPct - targetPct : null;

      return {
        focus,
        focusLabel: TRAINING_FOCUS_LABELS[focus],
        count,
        actualPct,
        targetPct,
        delta,
      };
    });

  return {
    rows,
    totalTrainings,
    hasTargets: targetMap.size > 0,
  };
}
