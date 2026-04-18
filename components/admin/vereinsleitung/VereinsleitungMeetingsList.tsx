import Link from "next/link";
import { CalendarDays, ChevronRight, Users } from "lucide-react";

const MEETINGS = [
  {
    title: "Vorstandssitzung April",
    slug: "vorstandssitzung-april",
    date: "16. Apr 2024",
    time: "20:00 Uhr",
    participants: 5,
    status: "Neueste",
  },
  {
    title: "Trainer-Rapport Rückrunde",
    slug: "trainer-rapport-rueckrunde",
    date: "15. Apr 2024",
    time: "18:30 Uhr",
    participants: 3,
    status: "Archiviert",
  },
  {
    title: "Medienkoordination Saisonstart",
    slug: "medienkoordination-saisonstart",
    date: "10. Apr 2024",
    time: "19:00 Uhr",
    participants: 4,
    status: "Archiviert",
  },
];

export default function VereinsleitungMeetingsList() {
  return (
    <div className="space-y-4">
      {MEETINGS.map((meeting) => (
        <Link
          key={meeting.slug}
          href={`/vereinsleitung/meetings/${meeting.slug}`}
          className="block rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-[1.05rem] font-semibold text-slate-900">
                {meeting.title}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {meeting.date} • {meeting.time}
                </span>

                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {meeting.participants} Teilnehmer
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {meeting.status}
              </span>

              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0b4aa2]">
                Öffnen
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
