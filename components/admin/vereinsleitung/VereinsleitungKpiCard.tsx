import { MoreHorizontal } from "lucide-react";

type KpiTrend = "up" | "down" | "neutral";

type KpiItem = {
  label: string;
  value: string;
  delta: string;
  note: string;
  trend: KpiTrend;
};

type VereinsleitungKpiCardProps = {
  items: KpiItem[];
};

function getDeltaClass(trend: KpiTrend) {
  switch (trend) {
    case "up":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "down":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungKpiCard({
  items,
}: VereinsleitungKpiCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.08rem] font-semibold text-slate-900">Club KPIs</h3>

        <div
          aria-label="Mehr Optionen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400"
        >
          <MoreHorizontal className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] text-slate-500">{kpi.label}</p>
                <p className="mt-2 text-[1.95rem] font-bold leading-none text-slate-900">
                  {kpi.value}
                </p>
              </div>

              <div
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDeltaClass(
                  kpi.trend,
                )}`}
              >
                {kpi.delta}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">{kpi.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
