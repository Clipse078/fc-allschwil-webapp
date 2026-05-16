import { CalendarDays, Circle, MoreHorizontal } from "lucide-react";

const TASKS = [
  {
    title: "Sponsoren­dossier finalisieren & drucken",
    owner: "Michael S.",
    ownerInitials: "MS",
    due: "18. Apr",
    priority: "High Prio",
  },
  {
    title: "Einladungen Generalversammlung versenden",
    owner: "Sarah W.",
    ownerInitials: "SW",
    due: "20. Apr",
    priority: null,
  },
  {
    title: "Trainingsplan Sommerhalle erstellen",
    owner: "Scotty M.",
    ownerInitials: "SM",
    due: "25. Apr",
    priority: null,
  },
];

export default function VereinsleitungTasksCard() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Offene Aufgaben
          </h3>
        </div>

        <button
          type="button"
          className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
        >
          Alle Tasks
        </button>
      </div>

      <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        {TASKS.map((task) => (
          <div
            key={task.title}
            className="flex items-start gap-4 px-4 py-4 transition hover:bg-slate-50/70"
          >
            <div className="pt-0.5">
              <button
                type="button"
                aria-label={`${task.title} auswählen`}
                className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
              >
                <Circle className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-slate-900">
                {task.title}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                    {task.ownerInitials}
                  </span>
                  {task.owner}
                </span>

                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {task.due}
                </span>

                {task.priority ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-600">
                    {task.priority}
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              aria-label="Mehr Optionen"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
