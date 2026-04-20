import Link from "next/link";
import { CalendarDays, ChevronRight, MoreHorizontal, Users } from "lucide-react";

type MeetingCardItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  dateLabel: string;
  timeLabel: string;
  linkedMatterCount: number;
  openMatterCount: number;
};

type VereinsleitungMeetingsCardProps = {
  meetings: MeetingCardItem[];
};

function getStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "DONE":
      return "Abgeschlossen";
    case "IN_PROGRESS":
      return "Laufend";
    default:
      return "Geplant";
  }
}

export default function VereinsleitungMeetingsCard({
  meetings,
}: VereinsleitungMeetingsCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.08rem] font-semibold text-slate-900">
          Nächste Meetings
        </h3>

        <Link
          href="/vereinsleitung/meetings"
          aria-label="Alle Meetings öffnen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Aktuell sind noch keine Meetings vorhanden.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-5 text-slate-900">
                  {meeting.title}
                </p>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                    meeting.status,
                  )}`}
                >
                  {getStatusLabel(meeting.status)}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>
                  {meeting.dateLabel} • {meeting.timeLabel}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{meeting.linkedMatterCount} Pendenzen</span>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {meeting.openMatterCount} offen
                  </span>
                </div>

                <Link
                  href={"/vereinsleitung/meetings/" + meeting.slug}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
                >
                  Details
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
