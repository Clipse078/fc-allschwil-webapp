/**
 * TODO: Initiative contribution scoring
 * Each initiative may carry a contributionWeight toward a parent Target.
 * Aggregate on the Target detail page as a secondary progress signal.
 *
 * TODO: Cross-Module Linking — Initiative ↔ Target FK
 * Replace Target.linkedInitiativeRefs JSONB with TargetInitiative junction table.
 */

import Link from "next/link";
import { Flag, MoreHorizontal, TrendingUp } from "lucide-react";
import type { InitiativeListItem } from "@/lib/initiatives/queries";

type VereinsleitungInitiativesCardProps = {
  initiatives?: InitiativeListItem[];
};

const DB_STATUS_CLASSES: Record<string, string> = {
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  ON_TRACK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PLANNED: "border-slate-200 bg-slate-50 text-slate-600",
  ON_HOLD: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

const DB_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Arbeit", ON_TRACK: "On Track", PLANNED: "Geplant",
  ON_HOLD: "Pausiert", COMPLETED: "Abgeschlossen", CANCELLED: "Abgesagt",
};

const MOCK_INITIATIVES = [
  { title: "Website Relaunch", owner: "Michael S.", status: "In Arbeit", progress: 60 },
  { title: "Neues Clubhaus Konzept", owner: "Sarah W.", status: "Geplant", progress: 10 },
  { title: "Sponsorenlauf 2025", owner: "Thomas K.", status: "On Track", progress: 80 },
];

function getStatusClass(status: string): string {
  return DB_STATUS_CLASSES[status] ?? "border-slate-200 bg-slate-50 text-slate-600";
}

export default function VereinsleitungInitiativesCard({ initiatives }: VereinsleitungInitiativesCardProps) {
  const hasRealData = initiatives && initiatives.length > 0;

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Initiativen</h3>
          {!hasRealData ? <p className="mt-0.5 text-[11px] text-slate-400">Demo-Daten</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/initiatives" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700">Alle</Link>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {hasRealData
          ? initiatives.map((ini) => (
              <Link key={ini.id} href={`/initiatives/${ini.slug}`} className="block space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#0b4aa2]/10">
                      <TrendingUp className="h-4 w-4 text-[#0b4aa2]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{ini.title}</p>
                      {ini.owner ? <p className="mt-0.5 text-xs text-slate-500">{ini.owner}</p> : null}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClass(ini.status)}`}>
                    {DB_STATUS_LABELS[ini.status] ?? ini.status}
                  </span>
                </div>
                {ini.progress !== null ? (
                  <div className="pl-11">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-[#0b4aa2]" style={{ width: `${Math.min(100, ini.progress)}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{ini.progress}%</span>
                    </div>
                  </div>
                ) : null}
              </Link>
            ))
          : MOCK_INITIATIVES.map((ini) => (
              <div key={ini.title} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#0b4aa2]/10">
                      <Flag className="h-4 w-4 text-[#0b4aa2]" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{ini.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{ini.owner}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                    ini.status === "In Arbeit" ? "border-blue-200 bg-blue-50 text-blue-700" :
                    ini.status === "On Track" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                    "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>{ini.status}</span>
                </div>
                <div className="pl-11">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-[#0b4aa2]" style={{ width: `${ini.progress}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-500">{ini.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
