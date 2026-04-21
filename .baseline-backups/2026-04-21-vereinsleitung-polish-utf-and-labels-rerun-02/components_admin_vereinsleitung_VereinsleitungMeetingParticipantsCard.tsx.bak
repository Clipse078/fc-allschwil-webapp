import { Users } from "lucide-react";
import type {
  MeetingParticipantItem,
  MeetingParticipantStats,
} from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingParticipantsCardProps = {
  participants: MeetingParticipantItem[];
  stats: MeetingParticipantStats;
};

function getStatusClass(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "text-emerald-700";
    case "EXCUSED":
      return "text-slate-500";
    case "ABSENT":
      return "text-rose-700";
    default:
      return "text-amber-700";
  }
}

export default function VereinsleitungMeetingParticipantsCard({
  participants,
  stats,
}: VereinsleitungMeetingParticipantsCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Teilnehmer</h3>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {stats.confirmed} / {stats.total}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          Anwesend: {stats.confirmed}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          Entschuldigt: {stats.excused}
        </span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
          Abwesend: {stats.absent}
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          Eingeladen: {stats.invited}
        </span>
      </div>

      {participants.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
          <p className="text-sm font-medium text-slate-700">
            Fuer dieses Meeting sind noch keine Teilnehmer hinterlegt.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Die Datenstruktur ist vorbereitet. Als naechstes kann die Teilnehmerverwaltung angebunden
            werden.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[11px] font-semibold text-[#0b4aa2]">
                  {participant.initials}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {participant.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {participant.roleLabel ?? "Ohne Rollenbezeichnung"}
                  </p>
                </div>
              </div>

              <span className={"shrink-0 text-xs font-semibold " + getStatusClass(participant.status)}>
                {participant.statusLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-600">
        Teilnehmerverwaltung folgt im naechsten Schritt
      </div>
    </section>
  );
}
