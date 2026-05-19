import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import type { MeetingLiveData } from "@/lib/meetings/queries";

type VereinsleitungMeetingInfoCardProps = {
  dbMeeting?: MeetingLiveData | null;
};

function formatSwissDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sce-primary-soft)] text-[var(--sce-primary)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function VereinsleitungMeetingInfoCard({
  dbMeeting,
}: VereinsleitungMeetingInfoCardProps) {
  if (dbMeeting) {
    return (
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="text-[1.08rem] font-semibold text-slate-900">
          Sitzungsinformationen
        </h3>

        {dbMeeting.description ? (
          <p className="mt-3 text-sm text-slate-500">{dbMeeting.description}</p>
        ) : null}

        <div className="mt-5 space-y-4">
          <InfoRow
            icon={CalendarDays}
            label="Datum"
            value={formatSwissDate(dbMeeting.meetingDate)}
          />

          <InfoRow
            icon={Clock3}
            label="Zeit"
            value={`${formatTime(dbMeeting.meetingDate)} Uhr`}
          />

          <InfoRow
            icon={MapPin}
            label="Ort"
            value={dbMeeting.location ?? "Kein Ort erfasst"}
          />

          {dbMeeting.attendeeCount ? (
            <InfoRow
              icon={Users}
              label="Teilnehmeranzahl"
              value={`${dbMeeting.attendeeCount} Personen`}
            />
          ) : null}
        </div>
      </section>
    );
  }

  // Legacy mock fallback — rendered when slug is not yet in DB
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <h3 className="text-[1.08rem] font-semibold text-slate-900">
        Sitzungsinformationen
      </h3>

      <div className="mt-5 space-y-4">
        <InfoRow icon={CalendarDays} label="Datum" value="Dienstag, 16. April 2024" />
        <InfoRow icon={Clock3} label="Zeit" value="20:00 - 21:00 Uhr" />
        <InfoRow icon={MapPin} label="Ort" value="Clubhaus, Sitzungszimmer 1" />
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sce-primary-soft)] text-[var(--sce-primary)]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
              Online Teilnahme
            </p>
            <button
              type="button"
              className="mt-1 text-sm font-semibold text-[var(--sce-primary)] transition hover:text-[var(--sce-primary-strong)]"
            >
              Microsoft Teams Link öffnen
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
