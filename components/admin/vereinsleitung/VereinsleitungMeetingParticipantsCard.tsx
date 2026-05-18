/**
 * TODO: MeetingParticipant model (Phase 2)
 *   Add a MeetingParticipant relation to Meeting:
 *     model MeetingParticipant {
 *       id         String  @id @default(cuid())
 *       meetingId  String
 *       personId   String?
 *       name       String
 *       role       String?
 *       status     ParticipantStatus @default(PRESENT)
 *       meeting    Meeting @relation(...)
 *       person     Person? @relation(...)
 *     }
 *   Surface named participants, attendance status, and "Teilnehmer verwalten" action here.
 */

import { Users } from "lucide-react";
import type { MeetingLiveData } from "@/lib/meetings/queries";

type VereinsleitungMeetingParticipantsCardProps = {
  dbMeeting?: MeetingLiveData | null;
};

const MOCK_PARTICIPANTS = [
  { name: "Michael Weber", role: "Präsident", initials: "MW", status: "Anwesend" },
  { name: "Sarah Meier", role: "Finanzen", initials: "SM", status: "Anwesend" },
  { name: "Thomas Schmid", role: "Sportlicher Leiter", initials: "TS", status: "Anwesend" },
  { name: "Elena Rossi", role: "Juniorenfussball", initials: "ER", status: "Entschuldigt" },
  { name: "David Keller", role: "Aktuar", initials: "DK", status: "Anwesend" },
];

function getStatusClass(status: string) {
  return status === "Anwesend" ? "text-emerald-700" : "text-slate-500";
}

export default function VereinsleitungMeetingParticipantsCard({
  dbMeeting,
}: VereinsleitungMeetingParticipantsCardProps) {
  if (dbMeeting) {
    const count = dbMeeting.attendeeCount;
    return (
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0b4aa2]" />
            <h3 className="text-[1.08rem] font-semibold text-slate-900">Teilnehmer</h3>
          </div>

          {count ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {count} Personen
            </span>
          ) : null}
        </div>

        <div className="mt-5 rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm text-slate-500">
            Namentliche Teilnehmer noch nicht erfasst.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Wird in einer späteren Version als MeetingParticipant erfasst.
          </p>
        </div>
      </section>
    );
  }

  // Legacy mock fallback
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Teilnehmer</h3>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          4 / 5
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {MOCK_PARTICIPANTS.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[11px] font-semibold text-[#0b4aa2]">
                {p.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="truncate text-xs text-slate-500">{p.role}</p>
              </div>
            </div>
            <span className={`shrink-0 text-xs font-semibold ${getStatusClass(p.status)}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
      >
        Teilnehmer verwalten
      </button>
    </section>
  );
}
