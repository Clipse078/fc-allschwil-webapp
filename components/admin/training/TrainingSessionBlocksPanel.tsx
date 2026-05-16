import { BookOpen, Lightbulb } from "lucide-react";
import { getTrainingBlocksVsTargets } from "@/lib/strategy/queries";
import { EXERCISE_CATALOG } from "@/lib/training/exercise-catalog";

type Props = {
  seasonId: string;
  teamId?: string | null;
  teamName?: string | null;
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        +{delta}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        {delta}%
      </span>
    );
  }
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

  const subtitle = teamName ? teamName : teamId ? null : "Alle Teams";

  const suggestions = data.rows.filter(
    (r) => r.delta !== null && r.delta < -5,
  );

  if (data.rows.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Trainingsblöcke
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        )}
        <p className="mt-4 text-sm text-slate-400">
          Noch keine Trainingsdaten mit Schwerpunkt erfasst.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Trainingsblöcke vs. Strategie-Ziele
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          {data.totalTrainings} Trainings
        </span>
      </div>

      {!data.hasTargets && (
        <p className="mt-3 text-xs text-slate-400">
          Keine Strategie-Ziele hinterlegt – nur Ist-Werte. Ziele unter{" "}
          <a href="/dashboard/strategy" className="underline hover:text-slate-600">
            Strategie
          </a>{" "}
          erfassen.
        </p>
      )}

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

      {suggestions.length > 0 && (
        <div className="mt-5 space-y-3">
          {suggestions.map((row) => {
            const exercises = EXERCISE_CATALOG.filter(
              (e) => e.focus === row.focus,
            ).slice(0, 2);

            return (
              <div
                key={row.focus}
                className="rounded-[16px] border border-amber-100 bg-amber-50/60 px-4 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">{row.focusLabel}</span> liegt{" "}
                    {Math.abs(row.delta!)}% unter dem Zielwert. Erwäge, beim nächsten
                    Training einen Block mit diesem Schwerpunkt einzuplanen.
                  </p>
                </div>
                {exercises.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 border-t border-amber-100 pt-2.5">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      <BookOpen className="h-3 w-3" />
                      Übungsvorschläge
                    </p>
                    {exercises.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <p className="text-[11px] font-medium text-amber-900">
                          {ex.title}
                        </p>
                        <span className="shrink-0 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] text-amber-600">
                          {ex.durationMinutes} Min.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
