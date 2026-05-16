import { prisma } from "@/lib/db/prisma";
import { TRAINING_FOCUS_LABELS } from "@/lib/training/labels";

// ── Types ────────────────────────────────────────────────────────────────────

export type TeamGuidanceKind =
  | "BELOW_TARGET"
  | "DOMINANCE"
  | "BALANCED"
  | "NO_TARGETS"
  | "NO_DATA";

export type TeamGuidanceSummary = {
  teamId: string;
  kind: TeamGuidanceKind;
  label: string;
  nextFocusMissing: boolean;
};

// ── Batch query ──────────────────────────────────────────────────────────────

export async function getTeamsGuidanceSummaries(
  seasonId: string,
  teamIds: string[],
): Promise<Map<string, TeamGuidanceSummary>> {
  if (teamIds.length === 0) return new Map();

  const now = new Date();

  const [taggedTrainings, targets, nextTrainings] = await Promise.all([
    prisma.event.findMany({
      where: {
        seasonId,
        type: "TRAINING",
        trainingFocus: { not: null },
        teamId: { in: teamIds },
      },
      select: { teamId: true, trainingFocus: true },
    }),
    prisma.strategyTarget.findMany({
      where: { seasonId, teamId: { in: teamIds } },
      select: { teamId: true, focus: true, targetPct: true },
    }),
    prisma.event.findMany({
      where: {
        seasonId,
        type: "TRAINING",
        teamId: { in: teamIds },
        startAt: { gt: now },
        status: { in: ["SCHEDULED", "LIVE"] },
      },
      orderBy: { startAt: "asc" },
      select: { teamId: true, trainingFocus: true },
    }),
  ]);

  // ── Index raw data ────────────────────────────────────────────────────────
  // focusCounts[teamId][focus] = count
  const focusCounts = new Map<string, Map<string, number>>();
  const totalTagged = new Map<string, number>();

  for (const t of taggedTrainings) {
    if (!t.teamId || !t.trainingFocus) continue;
    const fm = focusCounts.get(t.teamId) ?? new Map<string, number>();
    fm.set(t.trainingFocus, (fm.get(t.trainingFocus) ?? 0) + 1);
    focusCounts.set(t.teamId, fm);
    totalTagged.set(t.teamId, (totalTagged.get(t.teamId) ?? 0) + 1);
  }

  // targetMap[teamId][focus] = targetPct
  const targetMap = new Map<string, Map<string, number>>();
  for (const tgt of targets) {
    if (!tgt.teamId) continue;
    const tm = targetMap.get(tgt.teamId) ?? new Map<string, number>();
    tm.set(tgt.focus, tgt.targetPct);
    targetMap.set(tgt.teamId, tm);
  }

  // Next training per team (first entry after ordering by startAt asc)
  const nextFocusByTeam = new Map<string, string | null>();
  for (const nt of nextTrainings) {
    if (!nt.teamId) continue;
    if (!nextFocusByTeam.has(nt.teamId)) {
      nextFocusByTeam.set(nt.teamId, nt.trainingFocus ?? null);
    }
  }

  // ── Compute per-team ──────────────────────────────────────────────────────
  const result = new Map<string, TeamGuidanceSummary>();

  for (const teamId of teamIds) {
    const teamTargets = targetMap.get(teamId);
    const teamFocusCounts = focusCounts.get(teamId);
    const total = totalTagged.get(teamId) ?? 0;
    const nextFocus = nextFocusByTeam.get(teamId); // undefined = no upcoming training
    const nextFocusMissing = nextFocus === null; // explicitly null = training exists, no focus

    let kind: TeamGuidanceKind;
    let label: string;

    if (!teamTargets || teamTargets.size === 0) {
      kind = total === 0 ? "NO_DATA" : "NO_TARGETS";
      label = total === 0 ? "Keine Daten" : "Keine Ziele hinterlegt";
    } else {
      // Compute deltas
      let mostBelowFocus: string | null = null;
      let mostBelowDelta = 0;
      let mostAboveFocus: string | null = null;
      let mostAboveDelta = 0;
      let allBalanced = true;

      for (const [focus, targetPct] of teamTargets) {
        const count = teamFocusCounts?.get(focus) ?? 0;
        const actualPct = total > 0 ? Math.round((count / total) * 100) : 0;
        const delta = actualPct - targetPct;

        if (delta < -2 && delta < mostBelowDelta) {
          mostBelowDelta = delta;
          mostBelowFocus = focus;
        }
        if (delta > 20 && delta > mostAboveDelta) {
          mostAboveDelta = delta;
          mostAboveFocus = focus;
        }
        if (Math.abs(delta) > 5) allBalanced = false;
      }

      if (mostBelowFocus) {
        kind = "BELOW_TARGET";
        const focusLabel =
          TRAINING_FOCUS_LABELS[mostBelowFocus as keyof typeof TRAINING_FOCUS_LABELS] ??
          mostBelowFocus;
        label = `${focusLabel} unter Ziel (${Math.abs(mostBelowDelta)}%)`;
      } else if (mostAboveFocus) {
        kind = "DOMINANCE";
        const focusLabel =
          TRAINING_FOCUS_LABELS[mostAboveFocus as keyof typeof TRAINING_FOCUS_LABELS] ??
          mostAboveFocus;
        label = `${focusLabel} dominiert`;
      } else if (allBalanced) {
        kind = "BALANCED";
        label = "Ausbalanciert";
      } else {
        kind = "NO_TARGETS";
        label = "Keine Ziele hinterlegt";
      }
    }

    result.set(teamId, { teamId, kind, label, nextFocusMissing });
  }

  return result;
}
