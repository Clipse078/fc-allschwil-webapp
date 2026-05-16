import type { TrainingSessionBlocksPanelData } from "@/lib/planner/queries";

type TrainingSessionBlocksPanelProps = {
  data: TrainingSessionBlocksPanelData;
};

function getDeltaClass(deltaPercentage: number) {
  if (Math.abs(deltaPercentage) <= 5) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (deltaPercentage > 0) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function formatDelta(deltaPercentage: number) {
  if (deltaPercentage === 0) {
    return "±0 PP";
  }

  return `${deltaPercentage > 0 ? "+" : ""}${deltaPercentage} PP`;
}

export default function TrainingSessionBlocksPanel({
  data,
}: TrainingSessionBlocksPanelProps) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="fca-eyebrow">Training Planner KPI</p>
          <h3 className="mt-2 text-[1.05rem] font-semibold text-slate-900">
            Strategie-Ziele vs. Trainingsblöcke
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Read-only Abgleich pro Team und Saison: geplanter Block-Anteil gegen
            passende Strategie-Zielwerte.
          </p>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {data.seasonName ?? "Keine Saison"}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {data.teams.length === 0 ? (
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Für diese Saison gibt es noch keine verknüpften Strategie-Ziele oder
            Trainingsblöcke.
          </div>
        ) : (
          data.teams.map((team) => (
            <article
              key={team.teamId}
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {team.teamName}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {team.totalTrainingBlocks} geplante Trainingsblöcke
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {team.targets.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Keine passenden Strategie-Ziele mit Verbesserungsbereich.
                  </p>
                ) : (
                  team.targets.map((target) => (
                    <div
                      key={target.id}
                      className="rounded-[18px] border border-slate-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {target.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {target.planTitle} · {target.improvementAreaLabel}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDeltaClass(
                            target.deltaPercentage,
                          )}`}
                        >
                          {formatDelta(target.deltaPercentage)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                        <span>Ziel: {target.targetPercentage}%</span>
                        <span>Geplant: {target.plannedPercentage}%</span>
                        <span>Blöcke: {target.plannedBlocks}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
