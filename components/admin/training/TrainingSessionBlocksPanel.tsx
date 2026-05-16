import { BookOpen, CheckCircle2, Lightbulb, TrendingDown } from "lucide-react";
import { getTrainingBlocksVsTargets } from "@/lib/strategy/queries";
import { EXERCISE_CATALOG } from "@/lib/training/exercise-catalog";
import { computeTrainerGuidance } from "@/lib/training/guidance";

type Props = {
  seasonId: string;
  teamId?: string | null;
  teamName?: string | null;
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0)
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        +{delta}%
      </span>
    );
  if (delta < 0)
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        {delta}%
      </span>
    );
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      ±0%
    </span>
  );
}

export default async function TrainingSessionBlocksPanel({
  seasonId,
  teamId,
  teamName,
}: Props) {
  const data = await getTrainingBlocksVsTargets(seasonId, teamId);
  const guidance = computeTrainerGuidance(data);

  const subtitle = teamName ? teamName : teamId ? null : "Alle Teams";

  if (data.rows.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Trainingsblöcke
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        <p className="mt-4 text-sm text-slate-400">
          Noch keine Trainingsdaten mit Schwerpunkt erfasst.
        </p>
      </section>
    );
  }

  const nextBlockExercises = guidance.nextBlock
    ? EXERCISE_CATALOG.filter((e) => e.focus === guidance.nextBlock!.focus).slice(0, 2)
    : [];

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Trainingsblöcke vs. Strategie-Ziele
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          {data.totalTrainings} Trainings
        </span>
      </div>

      {!data.hasTargets && (
        <p className="mt-3 text-xs text-slate-400">
          Keine Strategie-Ziele hinterlegt – nur Ist-Werte.{" "}
          <a href="/dashboard/strategy" className="underline hover:text-slate-600">
            Ziele erfassen
          </a>
          .
        </p>
      )}

      {/* ── Bar charts ── */}
      <div className="mt-4 space-y-3">
        {data.rows.map((row) => (
          <div key={row.focus} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                {row.focusLabel}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {row.actualPct}%
                </span>
                {row.targetPct !== null && (
                  <span className="text-xs text-slate-400">
                    Ziel {row.targetPct}%
                  </span>
                )}
                {row.delta !== null && <DeltaBadge delta={row.delta} />}
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-[#0b4aa2]"
                style={{ width: `${row.actualPct}%` }}
              />
              {row.targetPct !== null && (
                <div
                  className="absolute top-0 h-2 w-0.5 rounded-full bg-slate-400"
                  style={{ left: `${row.targetPct}%` }}
                  title={`Ziel: ${row.targetPct}%`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Trainer guidance ── */}
      {(guidance.nextBlock ||
        guidance.dominanceWarnings.length > 0 ||
        guidance.otherBelowTarget.length > 0 ||
        guidance.isBalanced) && (
        <div className="mt-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Trainer-Empfehlung
          </p>

          {/* Recommended next block */}
          {guidance.nextBlock && (
            <div className="rounded-[16px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 p-4">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#0b4aa2]">
                    Empfohlener nächster Block:{" "}
                    {guidance.nextBlock.focusLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                    {guidance.nextBlock.reason}
                  </p>
                </div>
                {guidance.nextBlock.gapPct !== null && (
                  <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    −{guidance.nextBlock.gapPct}%
                  </span>
                )}
              </div>

              {nextBlockExercises.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-[#0b4aa2]/10 pt-3">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#0b4aa2]">
                    <BookOpen className="h-3 w-3" />
                    Passende Übungen
                  </p>
                  {nextBlockExercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between gap-2 rounded-[10px] bg-white/70 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-800">
                          {ex.title}
                        </p>
                        {ex.coachingPoints && (
                          <p className="mt-0.5 truncate text-[10px] text-slate-500">
                            {ex.coachingPoints.slice(0, 80)}
                            {ex.coachingPoints.length > 80 ? "…" : ""}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {ex.durationMinutes} Min.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dominance warnings */}
          {guidance.dominanceWarnings.map((w) => (
            <div
              key={w.focus}
              className="flex items-start gap-2.5 rounded-[16px] border border-amber-100 bg-amber-50/70 px-4 py-3"
            >
              <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                {w.message}
              </p>
            </div>
          ))}

          {/* Other below-target reminders */}
          {guidance.otherBelowTarget.map((r) => (
            <div
              key={r.focus}
              className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">{r.focusLabel}</span> liegt{" "}
                {r.gapPct}% unter Ziel ({r.currentPct}% / {r.targetPct}%).
              </p>
              <a
                href="/dashboard/training/exercises"
                className="shrink-0 text-[11px] font-semibold text-[#0b4aa2] hover:underline"
              >
                Übungen
              </a>
            </div>
          ))}

          {/* Balance confirmation */}
          {guidance.isBalanced && (
            <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <p className="text-[11px] font-semibold text-emerald-800">
                Trainingsplan ist gut ausbalanciert – alle Ziele im Bereich.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
