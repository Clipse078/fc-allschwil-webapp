import Link from "next/link";
import { CalendarDays, ChevronRight, Users } from "lucide-react";
import type { MeetingListItem } from "@/lib/meetings/queries";

type VereinsleitungMeetingsCardProps = {
  meetings?: MeetingListItem[];
};

const STATUS_LABELS: Record<string, string> = { PLANNED: "Geplant", COMPLETED: "Abgeschlossen", CANCELLED: "Abgesagt" };

function formatSwissDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}

const MOCK_MEETINGS = [
  { id: "m1", title: "Vorstandssitzung April", dateLabel: "12. Apr 2025 · 19:00 Uhr", status: "Geplant", href: "/meetings" },
  { id: "m2", title: "Trainer-Rapport Rückrunde", dateLabel: "15. Apr 2025 · 18:30 Uhr", status: "Bestätigt", href: "/meetings" },
  { id: "m3", title: "Medienkoordination", dateLabel: "20. Apr 2025 · 10:00 Uhr", status: "Geplant", href: "/meetings" },
];

export default function VereinsleitungMeetingsCard({ meetings = [] }: VereinsleitungMeetingsCardProps) {
  const hasRealData = meetings.length > 0;

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.08rem] font-semibold text-slate-900">
          {hasRealData ? "Meetings" : "Meetings · Demo"}
        </h3>
        <Link href="/meetings" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700">
          Alle anzeigen
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {hasRealData
          ? meetings.map((m) => (
              <Link key={m.id} href={`/meetings/${m.slug}`}
                className="flex items-start justify-between gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.title}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {formatSwissDate(m.meetingDate)}
                    {m.attendeeCount ? <><Users className="h-3.5 w-3.5 shrink-0 ml-1" />{m.attendeeCount}</> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{STATUS_LABELS[m.status] ?? m.status}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))
          : MOCK_MEETINGS.map((m) => (
              <Link key={m.id} href={m.href}
                className="flex items-start justify-between gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-md">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.title}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />{m.dateLabel}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{m.status}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
