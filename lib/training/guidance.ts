import type { TrainingBlockRow, TrainingBlocksVsTargets } from "@/lib/strategy/queries";

export type NextBlockRecommendation = {
  focus: string;
  focusLabel: string;
  currentPct: number;
  targetPct: number | null;
  gapPct: number | null;
  reason: string;
};

export type DominanceWarning = {
  focus: string;
  focusLabel: string;
  actualPct: number;
  targetPct: number | null;
  overBy: number | null;
  message: string;
};

export type BelowTargetReminder = {
  focus: string;
  focusLabel: string;
  currentPct: number;
  targetPct: number;
  gapPct: number;
};

export type TrainerGuidance = {
  nextBlock: NextBlockRecommendation | null;
  dominanceWarnings: DominanceWarning[];
  otherBelowTarget: BelowTargetReminder[];
  isBalanced: boolean;
};

function buildNextBlock(row: TrainingBlockRow): NextBlockRecommendation {
  const gap = row.delta !== null ? Math.abs(row.delta) : null;
  const reason =
    row.actualPct === 0
      ? `${row.focusLabel} wurde diese Saison noch nicht eingeplant. Ziel: ${row.targetPct}%.`
      : `${row.focusLabel}-Fokus liegt ${gap}% unter dem Saisonziel.`;

  return {
    focus: row.focus,
    focusLabel: row.focusLabel,
    currentPct: row.actualPct,
    targetPct: row.targetPct,
    gapPct: gap,
    reason,
  };
}

export function computeTrainerGuidance(
  data: TrainingBlocksVsTargets,
): TrainerGuidance {
  const { rows, hasTargets } = data;

  if (rows.length === 0) {
    return {
      nextBlock: null,
      dominanceWarnings: [],
      otherBelowTarget: [],
      isBalanced: false,
    };
  }

  // ── Recommended next block ────────────────────────────────────────────────
  // Most under-target focus (largest negative delta). Threshold: < -2.
  const belowRows = rows
    .filter((r) => r.delta !== null && r.delta < -2)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  const nextBlock = belowRows.length > 0 ? buildNextBlock(belowRows[0]) : null;

  // ── Other below-target (skip the top one already shown as nextBlock) ──────
  const otherBelowTarget: BelowTargetReminder[] = belowRows
    .slice(1)
    .filter((r) => r.targetPct !== null)
    .map((r) => ({
      focus: r.focus,
      focusLabel: r.focusLabel,
      currentPct: r.actualPct,
      targetPct: r.targetPct!,
      gapPct: Math.abs(r.delta!),
    }));

  // ── Dominance warnings ────────────────────────────────────────────────────
  // With a target: >20% over. Without a target: >60% share.
  const dominanceWarnings: DominanceWarning[] = rows
    .filter((r) => {
      if (r.targetPct !== null && r.delta !== null) return r.delta > 20;
      return r.targetPct === null && r.actualPct > 60;
    })
    .map((r) => {
      const overBy = r.targetPct !== null && r.delta !== null ? r.delta : null;
      const message =
        overBy !== null
          ? `${r.focusLabel} liegt ${overBy}% über dem Zielwert (${r.actualPct}% aktuell, Ziel: ${r.targetPct}%). Prüfe ob andere Bereiche mehr Raum brauchen.`
          : `${r.focusLabel} macht ${r.actualPct}% aller Trainings aus. Prüfe ob das die gewünschte Balance widerspiegelt.`;

      return {
        focus: r.focus,
        focusLabel: r.focusLabel,
        actualPct: r.actualPct,
        targetPct: r.targetPct,
        overBy,
        message,
      };
    });

  // ── Balance check ─────────────────────────────────────────────────────────
  const targetRows = rows.filter((r) => r.targetPct !== null);
  const isBalanced =
    hasTargets &&
    targetRows.length > 0 &&
    targetRows.every((r) => r.delta !== null && Math.abs(r.delta) <= 5);

  return { nextBlock, dominanceWarnings, otherBelowTarget, isBalanced };
}
