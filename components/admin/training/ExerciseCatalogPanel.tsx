import { ExerciseSport } from "@prisma/client";
import {
  EXERCISE_CATALOG,
  type ExerciseTemplate,
} from "@/lib/training/exercise-catalog";
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_SPORT_LABELS,
  TRAINING_FOCUS_LABELS,
} from "@/lib/training/labels";
import { importExerciseTemplate } from "@/app/(admin)/dashboard/training/exercises/actions";

type Props = {
  seasonId?: string | null;
  importedTemplateIds: Set<string>;
  sportFilter?: ExerciseSport | null;
};

const DIFFICULTY_COLORS = {
  BEGINNER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INTERMEDIATE: "border-amber-200 bg-amber-50 text-amber-700",
  ADVANCED: "border-rose-200 bg-rose-50 text-rose-700",
};

function ExerciseTemplateCard({
  tpl,
  alreadyImported,
  seasonId,
}: {
  tpl: ExerciseTemplate;
  alreadyImported: boolean;
  seasonId?: string | null;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-semibold text-slate-900">{tpl.title}</h4>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_COLORS[tpl.difficulty]}`}
            >
              {EXERCISE_DIFFICULTY_LABELS[tpl.difficulty]}
            </span>
            <span className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2 py-0.5 text-[10px] font-semibold text-[#0b4aa2]">
              {TRAINING_FOCUS_LABELS[tpl.focus]}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {tpl.description}
          </p>
        </div>

        <div className="shrink-0">
          {alreadyImported ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              Importiert
            </span>
          ) : (
            <form action={importExerciseTemplate}>
              <input type="hidden" name="templateId" value={tpl.id} />
              {seasonId && (
                <input type="hidden" name="seasonId" value={seasonId} />
              )}
              <button
                type="submit"
                className="rounded-full border border-[#0b4aa2]/30 bg-[#0b4aa2]/5 px-3 py-1.5 text-[11px] font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
              >
                Importieren
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {tpl.durationMinutes && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Dauer:</span>{" "}
            {tpl.durationMinutes} Min.
          </p>
        )}
        {tpl.equipment && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Material:</span>{" "}
            {tpl.equipment}
          </p>
        )}
        {tpl.audienceTags.length > 0 && (
          <p className="text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">Zielgruppe:</span>{" "}
            {tpl.audienceTags.join(", ")}
          </p>
        )}
      </div>

      {tpl.coachingPoints && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-slate-600">
            Coaching Points & Setup
          </summary>
          <div className="mt-2 space-y-1.5 rounded-[12px] bg-slate-50 p-3">
            {tpl.setup && (
              <p className="text-[11px] leading-relaxed text-slate-600">
                <span className="font-semibold">Aufbau:</span> {tpl.setup}
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold">Coaching:</span>{" "}
              {tpl.coachingPoints}
            </p>
            {tpl.variations && (
              <p className="text-[11px] leading-relaxed text-slate-600">
                <span className="font-semibold">Variationen:</span>{" "}
                {tpl.variations}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export default function ExerciseCatalogPanel({
  seasonId,
  importedTemplateIds,
  sportFilter,
}: Props) {
  const allSports = Object.values(ExerciseSport) as ExerciseSport[];
  const visibleSports = sportFilter ? [sportFilter] : allSports;

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <h3 className="text-[1.05rem] font-semibold text-slate-900">
        Premium-Übungskatalog
      </h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Kuratierte Übungen für Amateurvereine · Global geschützt · Editierbar nach Import
      </p>

      <div className="mt-5 space-y-6">
        {visibleSports.map((sport) => {
          const exercises = EXERCISE_CATALOG.filter((e) => e.sport === sport);
          if (exercises.length === 0) return null;

          return (
            <div key={sport}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {EXERCISE_SPORT_LABELS[sport]}
                <span className="ml-2 font-normal normal-case">
                  ({exercises.length} Übungen)
                </span>
              </p>
              <div className="space-y-3">
                {exercises.map((tpl) => (
                  <ExerciseTemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    alreadyImported={importedTemplateIds.has(tpl.id)}
                    seasonId={seasonId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
