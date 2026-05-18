import { CheckCircle2 } from "lucide-react";

type DecisionShape = {
  id: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "CONFIRMED" | "SUPERSEDED";
  owner?: string | null;
};

type Props = { isDbBacked?: boolean; decisions?: DecisionShape[] };

const STATUS_CLASSES: Record<DecisionShape["status"], string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUPERSEDED: "border-slate-200 bg-slate-50 text-slate-500",
};

const STATUS_LABELS: Record<DecisionShape["status"], string> = {
  DRAFT: "Entwurf",
  CONFIRMED: "Angenommen",
  SUPERSEDED: "Überholt",
};

const MOCK = [
  { title: "Budgetfreigabe Website-Phase 2", status: "Angenommen", description: "Freigabe der verbleibenden CHF 5'000 für die technische Umsetzung des Website Relaunches.", owner: "Sarah Meier", ownerInitials: "SM" },
  { title: "Erhöhung Ausbildungsbudget", status: "Angenommen", description: "Das jährliche Budget für Trainerausbildungen wird ab nächster Saison um 15% erhöht.", owner: "Thomas Schmid", ownerInitials: "TS" },
];

export default function VereinsleitungMeetingDecisionsCard({ isDbBacked, decisions }: Props) {
  if (isDbBacked) {
    return (
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Gefasste Beschlüsse</h3>
        </div>
        {decisions && decisions.length > 0 ? (
          <div className="mt-6 space-y-4">
            {decisions.map((d) => (
              <article key={d.id} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[1rem] font-semibold text-slate-900">{d.title}</h4>
                    {d.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{d.description}</p> : null}
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASSES[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                </div>
                {d.owner ? <p className="mt-3 text-right text-xs text-slate-500">Verantwortlich: <span className="font-medium text-slate-700">{d.owner}</span></p> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm text-slate-500">Beschlüsse noch nicht erfasst.</p>
            <p className="mt-1 text-[11px] text-slate-400">POST /api/meetings/[id]/decisions</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">Gefasste Beschlüsse</h3>
      </div>
      <div className="mt-6 space-y-4">
        {MOCK.map((d) => (
          <article key={d.title} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h4 className="text-[1rem] font-semibold text-slate-900">{d.title}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{d.description}</p></div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{d.status}</span>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
              <span>Verantwortlich:</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">{d.ownerInitials}</span>
              <span className="font-medium text-slate-700">{d.owner}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
