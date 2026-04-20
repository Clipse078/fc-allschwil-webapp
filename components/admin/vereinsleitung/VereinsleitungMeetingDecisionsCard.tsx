import { CheckCircle2 } from "lucide-react";

type VereinsleitungMeetingDecisionsCardProps = {
  decisionsCount: number;
};

export default function VereinsleitungMeetingDecisionsCard({
  decisionsCount,
}: VereinsleitungMeetingDecisionsCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Beschluesse</h3>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {decisionsCount}
        </span>
      </div>

      {decisionsCount > 0 ? (
        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          Beschluesse werden in einem naechsten Schritt an die kuenftige Decisions-Struktur angebunden.
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
          <p className="text-sm font-medium text-slate-700">
            Fuer dieses Meeting sind noch keine Beschluesse erfasst.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dieser Bereich ist bereits auf eine spaetere Beschluss-Erfassung mit Review- und
            Freigabelogik vorbereitet.
          </p>
        </div>
      )}
    </section>
  );
}
