import { TrainingFocus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TRAINING_FOCUS_LABELS } from "@/lib/training/labels";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shortWeekLabel(key: string): string {
  const [, week] = key.split("-W");
  return `KW ${parseInt(week, 10)}`;
}

const MONTH_SHORT = ["Jan.", "Feb.", "Mär.", "Apr.", "Mai", "Jun.", "Jul.", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
function shortMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_SHORT[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendStatus = "ABOVE" | "BELOW" | "ON_TARGET" | "NO_DATA";
export type TrendDirection = "IMPROVING" | "DECLINING" | "STABLE";

export type PeriodPoint = {
  label: string;   // "KW 42" or "Mär. 25"
  pct: number;
};

export type FocusTrendRow = {
  focus: TrainingFocus;
  focusLabel: string;
  targetPct: number | null;
  seasonPct: number;
  totalTrainings: number;
  weeklyPoints: PeriodPoint[];   // last 4 weeks with data
  monthlyPoints: PeriodPoint[];  // last 3 months with data
  status: TrendStatus;
  weeklyTrend: TrendDirection | null;
  monthlyTrend: TrendDirection | null;
  suggestion: string | null;
};

// ─── Core query ──────────────────────────────────────────────────────────────

export async function getFocusTrends(
  seasonId: string,
  teamId?: string | null,
): Promise<FocusTrendRow[]> {
  const [trainings, targets] = await Promise.all([
    prisma.event.findMany({
      where: {
        seasonId,
        type: "TRAINING",
        trainingFocus: { not: null },
        ...(teamId ? { teamId } : {}),
      },
      select: { trainingFocus: true, startAt: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.strategyTarget.findMany({
      where: { seasonId, teamId: teamId ?? null },
      select: { focus: true, targetPct: true },
    }),
  ]);

  if (targets.length === 0) return [];

  const targetMap = new Map(targets.map((t) => [t.focus, t.targetPct]));
  const allFocuses = [...targetMap.keys()].sort();

  // ── Season totals ──
  const totalTrainings = trainings.length;
  const seasonCount = new Map<TrainingFocus, number>();
  for (const t of trainings) {
    if (t.trainingFocus) {
      seasonCount.set(t.trainingFocus, (seasonCount.get(t.trainingFocus) ?? 0) + 1);
    }
  }

  // ── Weekly buckets ──
  const weekTotals = new Map<string, number>();
  const weekFocusCount = new Map<string, Map<TrainingFocus, number>>();

  for (const t of trainings) {
    const wk = isoWeekKey(t.startAt);
    weekTotals.set(wk, (weekTotals.get(wk) ?? 0) + 1);
    const fm = weekFocusCount.get(wk) ?? new Map();
    if (t.trainingFocus) fm.set(t.trainingFocus, (fm.get(t.trainingFocus) ?? 0) + 1);
    weekFocusCount.set(wk, fm);
  }

  const sortedWeeks = [...weekTotals.keys()].sort().slice(-6);

  // ── Monthly buckets ──
  const monthTotals = new Map<string, number>();
  const monthFocusCount = new Map<string, Map<TrainingFocus, number>>();

  for (const t of trainings) {
    const mk = monthKey(t.startAt);
    monthTotals.set(mk, (monthTotals.get(mk) ?? 0) + 1);
    const fm = monthFocusCount.get(mk) ?? new Map();
    if (t.trainingFocus) fm.set(t.trainingFocus, (fm.get(t.trainingFocus) ?? 0) + 1);
    monthFocusCount.set(mk, fm);
  }

  const sortedMonths = [...monthTotals.keys()].sort().slice(-4);

  // ── Build rows ──
  return allFocuses.map((focus): FocusTrendRow => {
    const targetPct = targetMap.get(focus) ?? null;
    const count = seasonCount.get(focus) ?? 0;
    const seasonPct =
      totalTrainings > 0 ? Math.round((count / totalTrainings) * 100) : 0;

    // Weekly points (last 4 weeks with any trainings)
    const weeklyPoints: PeriodPoint[] = sortedWeeks
      .slice(-4)
      .map((wk) => {
        const total = weekTotals.get(wk) ?? 0;
        const focusInWeek = weekFocusCount.get(wk)?.get(focus) ?? 0;
        const pct = total > 0 ? Math.round((focusInWeek / total) * 100) : 0;
        return { label: shortWeekLabel(wk), pct };
      });

    // Monthly points (last 3 months)
    const monthlyPoints: PeriodPoint[] = sortedMonths
      .slice(-3)
      .map((mk) => {
        const total = monthTotals.get(mk) ?? 0;
        const focusInMonth = monthFocusCount.get(mk)?.get(focus) ?? 0;
        const pct = total > 0 ? Math.round((focusInMonth / total) * 100) : 0;
        return { label: shortMonthLabel(mk), pct };
      });

    // Status
    let status: TrendStatus = "NO_DATA";
    if (totalTrainings > 0 && targetPct !== null) {
      if (seasonPct >= targetPct + 2) status = "ABOVE";
      else if (seasonPct < targetPct - 2) status = "BELOW";
      else status = "ON_TARGET";
    }

    // Weekly trend: compare last 2 weekly points
    let weeklyTrend: TrendDirection | null = null;
    if (weeklyPoints.length >= 2) {
      const recent = weeklyPoints[weeklyPoints.length - 1].pct;
      const prev = weeklyPoints[weeklyPoints.length - 2].pct;
      if (recent - prev >= 4) weeklyTrend = "IMPROVING";
      else if (prev - recent >= 4) weeklyTrend = "DECLINING";
      else weeklyTrend = "STABLE";
    }

    // Monthly trend: compare last 2 monthly points
    let monthlyTrend: TrendDirection | null = null;
    if (monthlyPoints.length >= 2) {
      const recent = monthlyPoints[monthlyPoints.length - 1].pct;
      const prev = monthlyPoints[monthlyPoints.length - 2].pct;
      if (recent - prev >= 3) monthlyTrend = "IMPROVING";
      else if (prev - recent >= 3) monthlyTrend = "DECLINING";
      else monthlyTrend = "STABLE";
    }

    // Suggestion
    const label = TRAINING_FOCUS_LABELS[focus];
    const suggestion = buildSuggestion(
      label,
      status,
      weeklyTrend,
      monthlyTrend,
      weeklyPoints,
      targetPct,
    );

    return {
      focus,
      focusLabel: label,
      targetPct,
      seasonPct,
      totalTrainings,
      weeklyPoints,
      monthlyPoints,
      status,
      weeklyTrend,
      monthlyTrend,
      suggestion,
    };
  });
}

// ─── Suggestion builder ───────────────────────────────────────────────────────

function countConsecutiveBelow(
  points: PeriodPoint[],
  targetPct: number | null,
): number {
  if (!targetPct) return 0;
  let n = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].pct < targetPct) n++;
    else break;
  }
  return n;
}

function buildSuggestion(
  label: string,
  status: TrendStatus,
  weeklyTrend: TrendDirection | null,
  monthlyTrend: TrendDirection | null,
  weeklyPoints: PeriodPoint[],
  targetPct: number | null,
): string | null {
  if (status === "NO_DATA") return null;

  const weeksBelow = countConsecutiveBelow(weeklyPoints, targetPct);

  if (status === "BELOW" && weeklyTrend === "DECLINING") {
    if (weeksBelow >= 3) {
      return `${label}-Fokus ist die letzten ${weeksBelow} Wochen unter dem Zielwert und sinkt weiter. Plane in den nächsten Trainings gezielt einen Block ein.`;
    }
    return `${label}-Fokus liegt unter dem Ziel und zeigt einen sinkenden Trend. Jetzt gegensteuern.`;
  }

  if (status === "BELOW" && weeklyTrend === "STABLE") {
    if (weeksBelow >= 2) {
      return `${label}-Fokus ist seit ${weeksBelow} Wochen unter dem Zielwert. Ein dedizierter Block beim nächsten Training würde helfen.`;
    }
    return `${label}-Fokus liegt knapp unter dem Ziel. Ein gezielter Trainingsblock reicht zum Ausgleich.`;
  }

  if (status === "BELOW" && weeklyTrend === "IMPROVING") {
    return `${label}-Fokus verbessert sich, liegt aber noch unter dem Zielwert. Kurs halten.`;
  }

  if (status === "ON_TARGET" && weeklyTrend === "DECLINING") {
    return `${label} ist im Zielbereich, zeigt aber einen sinkenden Wochentrend. Aufmerksamkeit behalten.`;
  }

  if (status === "ABOVE" && monthlyTrend === "DECLINING") {
    return `${label} war über Ziel, sinkt aber monatlich. Bleibt vorerst im grünen Bereich.`;
  }

  if (status === "ABOVE") {
    return `${label}-Fokus liegt über dem Zielwert. Prüfe ob andere Bereiche mehr Raum brauchen.`;
  }

  return null;
}
