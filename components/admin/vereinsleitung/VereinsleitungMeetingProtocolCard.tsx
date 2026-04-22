import { ClipboardList } from "lucide-react";
import { type MeetingProtocolEntryItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingProtocolCardProps = {
  meetingId: string;
  notes: string | null;
  protocolEntries: MeetingProtocolEntryItem[];
};

export default function VereinsleitungMeetingProtocolCard({
  protocolEntries,
}: VereinsleitungMeetingProtocolCardProps) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
      <div className="p-7">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Protokoll-Übersicht</h3>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{protocolEntries.length}</p>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Mit Traktandum
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {protocolEntries.filter((entry) => Boolean(entry.agendaItemId)).length}
            </p>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Erfassung erfolgt jetzt primär im Ausführungsbereich pro Traktandum.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}