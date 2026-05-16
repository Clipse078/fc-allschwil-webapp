import { CalendarDays, ChevronRight, MoreHorizontal, Users } from "lucide-react";

const MEETINGS = [
  {
    title: "Vorstandssitzung April",
    date: "12. Apr 2025 • 19:00 Uhr",
    status: "Geplant",
    participants: ["MS", "SW", "TK", "PM"],
  },
  {
    title: "Trainer-Rapport Rückrunde",
    date: "15. Apr 2025 • 18:30 Uhr",
    status: "Bestätigt",
    participants: ["SM", "LV", "AD"],
  },
];

function getStatusClass(status: string) {
  switch (status) {
    case "Bestätigt":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Geplant":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungMeetingsCard() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.08rem] font-semibold text-slate-900">
          Nächste Meetings
        </h3>

        <button
          type="button"
          aria-label="Mehr Optionen"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {MEETINGS.map((meeting) => (
          <div
            key={meeting.title}
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
                {meeting.status}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{meeting.date}</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {meeting.participants.map((participant) => (
                    <div
                      key={`${meeting.title}-${participant}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]"
                    >
                      {participant}
                    </div>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>{meeting.participants.length} Teilnehmer</span>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
              >
                Details
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
