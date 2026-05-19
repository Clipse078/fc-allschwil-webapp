import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { TargetListItem } from "@/lib/targets/queries";

type VereinsleitungGoalsCardProps = {
  targets?: TargetListItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  SPORTLICHE_ENTWICKLUNG: "Sportliche Entwicklung",
  MITGLIEDERWACHSTUM: "Mitgliederwachstum",
  FINANZEN: "Finanzen & Infrastruktur",
  AUSBILDUNG: "Ausbildung",
  MEDIEN_SOZIALES: "Medien & Soziales",
  GOVERNANCE: "Governance",
};

function computeProgress(metrics: TargetListItem["metrics"]): number {
  if (metrics.length === 0) return 0;
  const first = metrics[0];
  if (!first || first.targetValue === 0) return 0;
  if (first.direction === "DECREASE") {
    const start = first.targetValue * 2;
    const ratio = (start - first.currentValue) / start;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }
  return Math.max(0, Math.min(100, Math.round((first.currentValue / first.targetValue) * 100)));
}

export default function VereinsleitungGoalsCard({ targets = [] }: VereinsleitungGoalsCardProps) {
  const hasRealData = targets.length > 0;

  const MOCK_GOALS = [
    { title: "Aufstieg 1. Mannschaft (2. Liga Inter)", category: "Sportliche Entwicklung", progress: 70 },
    { title: "Ausbau Juniorenabteilung (Mädchen)", category: "Mitgliederwachstum", progress: 40 },
    { title: "Sponsoring-Einnahmen steigern (+15%)", category: "Finanzen & Infrastruktur", progress: 85 },
  ];

  const displayItems = hasRealData
    ? targets.map((t) => ({
        id: t.id,
        title: t.title,
        category: CATEGORY_LABELS[t.category] ?? t.category,
        progress: computeProgress(t.metrics),
        href: `/targets/${t.id}`,
      }))
    : MOCK_GOALS.map((g, i) => ({ id: String(i), title: g.title, category: g.category, progress: g.progress, href: "/targets" }));

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            {hasRealData ? "Aktuelle Ziele" : "Saisonziele 2025/26"}
          </h3>
          {!hasRealData ? (
            <p className="mt-0.5 text-[11px] text-slate-400">
              Demo-Daten ·{" "}
              <Link href="/targets" className="text-[#3f63b5] hover:underline">
                echte Ziele erfassen
              </Link>
            </p>
          ) : null}
        </div>

        <Link
          href="/targets"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Alle Ziele
          </span>
        </Link>
      </div>

      <div className="mt-7 space-y-6">
        {displayItems.map((item) => (
          <Link key={item.id} href={item.href} className="block space-y-2.5 transition hover:opacity-80">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-6 text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.category}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-[#3f63b5]">{item.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full transition-all ${item.progress >= 90 ? "bg-emerald-500" : item.progress >= 60 ? "bg-[#0b4aa2]" : item.progress >= 30 ? "bg-amber-500" : "bg-rose-400"}`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
