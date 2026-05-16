import { GoalModule } from "@prisma/client";
import {
  GOAL_MODULE_LABELS,
  getTemplatesByModule,
} from "@/lib/strategy/goal-templates";
import {
  getClubGoalsBySeason,
  groupGoalsByModule,
} from "@/lib/strategy/club-goal-queries";
import { importGoalTemplate, createCustomGoal } from "@/app/(admin)/dashboard/strategy/actions";
import GoalRow from "@/components/admin/strategy/GoalRow";

type Props = {
  seasonId: string;
  seasonName: string;
};

const ALL_MODULES = Object.values(GoalModule) as GoalModule[];

export default async function ClubGoalsPanel({ seasonId, seasonName }: Props) {
  const goals = await getClubGoalsBySeason(seasonId);
  const byModule = groupGoalsByModule(goals);
  const templatesByModule = getTemplatesByModule();

  const importedTemplateIds = new Set(goals.map((g) => g.templateId).filter(Boolean));

  return (
    <div className="space-y-6">
      {/* Existing goals */}
      {goals.length > 0 && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Meine Strategieziele
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">{seasonName}</p>

          <div className="mt-5 space-y-5">
            {ALL_MODULES.filter((m) => byModule.has(m)).map((module) => {
              const moduleGoals = byModule.get(module)!;
              return (
                <div key={module}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {GOAL_MODULE_LABELS[module]}
                  </p>
                  <div className="space-y-2">
                    {moduleGoals.map((g) => (
                      <GoalRow key={g.id} goal={g} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Template catalog */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[1.05rem] font-semibold text-slate-900">
              Empfohlene Ziele laden
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Amateur-Vereinsvorlagen · Sport-bewusst · Saison-gebunden · editierbar nach Import
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {ALL_MODULES.map((module) => {
            const templates = templatesByModule.get(module) ?? [];
            if (templates.length === 0) return null;

            return (
              <div key={module}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {GOAL_MODULE_LABELS[module]}
                </p>
                <div className="space-y-2">
                  {templates.map((tpl) => {
                    const alreadyImported = importedTemplateIds.has(tpl.id);
                    return (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{tpl.title}</p>
                          {tpl.metricValue && tpl.metricLabel && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {tpl.metricValue} {tpl.metricLabel}
                            </p>
                          )}
                          <span className="mt-1 inline-block rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {tpl.sport === "football" ? "Fussball" : "Alle Sportarten"}
                          </span>
                        </div>

                        {alreadyImported ? (
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Importiert
                          </span>
                        ) : (
                          <form action={importGoalTemplate}>
                            <input type="hidden" name="templateId" value={tpl.id} />
                            <input type="hidden" name="seasonId" value={seasonId} />
                            <button
                              type="submit"
                              className="shrink-0 rounded-full border border-[#0b4aa2]/30 bg-[#0b4aa2]/5 px-3 py-1.5 text-[11px] font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
                            >
                              Importieren
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom goal form */}
      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.05rem] font-semibold text-slate-900">
          Eigenes Ziel hinzufügen
        </h3>
        <form action={createCustomGoal} className="mt-4 space-y-3">
          <input type="hidden" name="seasonId" value={seasonId} />
          <select
            name="module"
            required
            className="w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
          >
            <option value="">Modul wählen …</option>
            {ALL_MODULES.map((m) => (
              <option key={m} value={m}>
                {GOAL_MODULE_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            placeholder="Zielbezeichnung"
            className="w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="metricValue"
              placeholder="Zielwert (z.B. 30)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
            />
            <input
              name="metricLabel"
              placeholder="Einheit (z.B. % pro Saison)"
              className="rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
            />
          </div>
          <textarea
            name="description"
            placeholder="Beschreibung (optional)"
            rows={2}
            className="w-full resize-none rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-[#0b4aa2]"
          />
          <button
            type="submit"
            className="rounded-full bg-[#0b4aa2] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a]"
          >
            Ziel erstellen
          </button>
        </form>
      </section>
    </div>
  );
}
