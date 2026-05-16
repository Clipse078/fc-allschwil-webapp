import { TrendingDown, TrendingUp, Minus, Lightbulb } from "lucide-react";
import { getFocusTrends, type FocusTrendRow, type TrendDirection, type TrendStatus } from "@/lib/strategy/trend-queries";

type Props = {
  seasonId: string;
  teamId?: string | null;
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<TrendStatus, string> = {
  ABOVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BELOW: "border-rose-200 bg-rose-50 text-rose-700",
  ON_TARGET: "border-[#0b4aa2]/20 bg-[#0b4aa2]/5 text-[#0b4aa2]",
  NO_DATA: "border-slate-200 bg-slate-50 text-slate-500",
};

const STATUS_LABELS: Record<TrendStatus, string> = {
  ABOVE: "Über Ziel",
  BELOW: "Unter Ziel",
  ON_TARGET: "Im Ziel",
  NO_DATA: "Keine Daten",
};

function TrendIcon({ trend }: { trend: TrendDirection }) {
  if (trend === "IMPROVING")
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "DECLINING")
    return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

const TREND_LABELS: Record<TrendDirection, string> = {
  IMPROVING: "Verbessernd",
  DECLINING: "Sinkend",
  STABLE: "Stabil",
};

// ─── Single trend card ────────────────────────────────────────────────────────

function TrendCard({ row }: { row: FocusTrendRow }) {
  const hasWeeklyPoints = row.weeklyPoints.length > 0;
  const hasMonthlyPoints = row.monthlyPoints.length > 0;

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.focusLabel}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">
              {row.seasonPct}%
            </span>
            {row.targetPct !== null && (
              <span className="text-xs text-slate-400">/ Ziel {row.targetPct}%</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[row.status]}`}
          >
            {STATUS_LABELS[row.status]}
          </span>
          {row.weeklyTrend && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <TrendIcon trend={row.weeklyTrend} />
              <span>{TREND_LABELS[row.weeklyTrend]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Weekly points */}
      {hasWeeklyPoints && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Wochentrend
          </p>
          <div className="flex items-end gap-2">
            {row.weeklyPoints.map((p, i) => {
              const isLast = i === row.weeklyPoints.length - 1;
              return (
                <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      isLast ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {p.pct}%
                  </span>
                  <div className="relative h-8 w-full rounded-[4px] bg-slate-100">
                    <div
                      className={`absolute bottom-0 w-full rounded-[4px] transition-all ${
                        row.targetPct !== null && p.pct >= row.targetPct
                          ? "bg-emerald-400"
                          : row.targetPct !== null && p.pct < row.targetPct - 5
                            ? "bg-rose-400"
                            : "bg-[#0b4aa2]/60"
                      }`}
                      style={{ height: `${Math.max(p.pct, 3)}%` }}
                    />
                    {row.targetPct !== null && (
                      <div
                        className="absolute left-0 right-0 h-px bg-slate-400"
                        style={{ bottom: `${row.targetPct}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400">{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly points */}
      {hasMonthlyPoints && (
        <div className="mt-3 flex items-center gap-3">
          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Monatstrend
          </p>
          <div className="flex items-center gap-2">
            {row.monthlyPoints.map((p, i) => {
              const isLast = i === row.monthlyPoints.length - 1;
              return (
                <span key={p.label} className="text-[11px]">
                  <span className="text-slate-400">{p.label}</span>{" "}
                  <span
                    className={`font-semibold ${
                      isLast ? "text-slate-900" : "text-slate-500"
                    }`}
                  >
                    {p.pct}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestion */}
      {row.suggestion && (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-100 bg-amber-50/70 px-3 py-2.5">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            {row.suggestion}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default async function TrendCardsPanel({ seasonId, teamId }: Props) {
  const rows = await getFocusTrends(seasonId, teamId);

  if (rows.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Trend-Analyse
        </h3>
        <p className="mt-3 text-sm text-slate-400">
          Noch keine Strategie-Ziele hinterlegt.{" "}
          <a href="/dashboard/strategy" className="font-semibold text-[#0b4aa2] hover:underline">
            Ziele erfassen
          </a>{" "}
          um Trends zu sehen.
        </p>
      </section>
    );
  }

  const belowCount = rows.filter((r) => r.status === "BELOW").length;
  const aboveCount = rows.filter((r) => r.status === "ABOVE").length;
  const decliningCount = rows.filter((r) => r.weeklyTrend === "DECLINING").length;

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Trend-Analyse
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Woche · Monat · Saison
          </p>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap justify-end gap-1.5">
          {belowCount > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
              {belowCount} unter Ziel
            </span>
          )}
          {aboveCount > 0 && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              {aboveCount} über Ziel
            </span>
          )}
          {decliningCount > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              {decliningCount} sinkend
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <TrendCard key={row.focus} row={row} />
        ))}
      </div>
    </section>
  );
}
