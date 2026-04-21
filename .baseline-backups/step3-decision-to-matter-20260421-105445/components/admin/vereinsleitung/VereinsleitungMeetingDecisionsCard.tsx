import { CheckCircle2 } from "lucide-react";
import { type MeetingDecisionItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDecisionsCardProps = {
  meetingId: string;
  decisions: MeetingDecisionItem[];
};

export default function VereinsleitungMeetingDecisionsCard({
  decisions,
}: VereinsleitungMeetingDecisionsCardProps) {
  const dueCount = decisions.filter((decision) => Boolean(decision.dueDateLabel)).length;
  const preparedMatterCount = decisions.filter((decision) => decision.createMatter).length;

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">Entscheidungs-Übersicht</h3>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Total
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{decisions.length}</p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Mit Fälligkeit
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dueCount}</p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Pendenz vorbereitet
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{preparedMatterCount}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-600">
        Neue Entscheide werden jetzt direkt im traktan­denbasierten Ausführungsbereich erfasst.
      </p>
    </section>
  );
}
