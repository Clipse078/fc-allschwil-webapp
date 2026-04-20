import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  ListChecks,
  MapPin,
} from "lucide-react";
import type { MeetingListItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingsListProps = {
  meetings: MeetingListItem[];
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
      return "Erledigt";
    case "IN_PROGRESS":
      return "In Arbeit";
    case "PLANNED":
      return "Geplant";
    default:
      return status;
  }
}

export default function VereinsleitungMeetingsList({
  meetings,
}: VereinsleitungMeetingsListProps) {
  if (meetings.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-base font-semibold text-slate-900">
          Noch keine Meetings vorhanden
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Sobald Meetings erfasst werden, erscheinen sie hier automatisch inklusive
          verknüpfter Pendenzen.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Link
          key={meeting.id}
          href={`/vereinsleitung/meetings/${meeting.slug}`}
          className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[1.05rem] font-semibold text-slate-900">
                  {meeting.title}
                </h3>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                    meeting.status,
                  )}`}
                >
                  {getStatusLabel(meeting.status)}
                </span>
              </div>

              {meeting.subtitle ? (
                <p className="mt-2 text-sm text-slate-600">{meeting.subtitle}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {meeting.dateLabel} • {meeting.timeLabel}
                </span>

                {meeting.location ? (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  {meeting.linkedMatterCount} verknüpfte Pendenzen
                </span>

                <span className="inline-flex items-center gap-2">
                  <CircleCheckBig className="h-4 w-4" />
                  {meeting.openMatterCount} offen / in Arbeit
                </span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2]">
              Öffnen
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
