type VereinsleitungInitiativeRoadmapProps = {
  status: string;
  startDateIso: string | null;
  targetDateIso: string | null;
  totalWorkItems: number;
  resolvedWorkItems: number;
  progressPercent: number;
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "DONE":
      return "Abgeschlossen";
    case "PLANNED":
      return "Geplant";
    default:
      return "In Arbeit";
  }
}

export default function VereinsleitungInitiativeRoadmap({
  status,
  startDateIso,
  targetDateIso,
  totalWorkItems,
  resolvedWorkItems,
  progressPercent,
}: VereinsleitungInitiativeRoadmapProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-[1.1rem] font-semibold text-slate-900">Roadmap</h3>
          <p className="mt-2 text-sm text-slate-500">
            Einfache Management-Sicht auf Zeitraum, Status und Fortschritt.
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {getStatusLabel(status)}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Start</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {formatDateLabel(startDateIso)}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Ziel</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {formatDateLabel(targetDateIso)}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Work Items</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{totalWorkItems}</div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Erledigt</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {resolvedWorkItems} / {totalWorkItems}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-900">Fortschritt</span>
          <span className="text-slate-500">{progressPercent}%</span>
        </div>

        <div className="mt-2 h-3 rounded-full bg-slate-100">
          <div
            className="h-3 rounded-full bg-[#7eb241]"
            style={{ width: progressPercent + "%" }}
          />
        </div>
      </div>
    </section>
  );
}