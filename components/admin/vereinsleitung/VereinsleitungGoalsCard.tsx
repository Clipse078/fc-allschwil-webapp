const GOALS = [
  {
    title: "Aufstieg 1. Mannschaft (2. Liga Inter)",
    category: "Sportliche Entwicklung",
    progress: 70,
  },
  {
    title: "Ausbau Juniorenabteilung (Mädchen)",
    category: "Mitgliederwachstum",
    progress: 40,
  },
  {
    title: "Sponsoring-Einnahmen steigern (+15%)",
    category: "Finanzen & Infrastruktur",
    progress: 85,
  },
];

export default function VereinsleitungGoalsCard() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Saisonziele 2025/26
          </h3>
        </div>

        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          Details
        </button>
      </div>

      <div className="mt-7 space-y-6">
        {GOALS.map((goal) => (
          <div key={goal.title} className="space-y-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-6 text-slate-900">
                  {goal.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{goal.category}</p>
              </div>

              <span className="shrink-0 text-sm font-semibold text-[#0b4aa2]">
                {goal.progress}%
              </span>
            </div>

            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-[#0b4aa2]"
                style={{ width: `${goal.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
