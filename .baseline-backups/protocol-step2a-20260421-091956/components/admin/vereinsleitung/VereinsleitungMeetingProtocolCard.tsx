import { ClipboardList } from "lucide-react";

type VereinsleitungMeetingProtocolCardProps = {
  notes: string | null;
};

export default function VereinsleitungMeetingProtocolCard({
  notes,
}: VereinsleitungMeetingProtocolCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">Protokoll / Notizen</h3>
      </div>

      {notes ? (
        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
          {notes}
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
          <p className="text-sm font-medium text-slate-700">
            Fuer dieses Meeting ist noch kein Protokoll hinterlegt.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Dieser Bereich ist vorbereitet fuer spaetere Protokollpflege, Review und Freigabe im
            Vier-Augen-Workflow.
          </p>
        </div>
      )}
    </section>
  );
}
