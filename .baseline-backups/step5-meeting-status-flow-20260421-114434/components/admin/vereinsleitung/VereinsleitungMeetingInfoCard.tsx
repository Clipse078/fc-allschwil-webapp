import { Globe, MapPin, MonitorSmartphone, Timer, Video } from "lucide-react";

type VereinsleitungMeetingInfoCardProps = {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  onlineMeetingUrl: string | null;
  meetingModeLabel: string;
  meetingProviderLabel: string;
  teamsSyncStatusLabel: string;
  externalMeetingUrl: string | null;
  teamsJoinUrl: string | null;
};

function getTeamsStatusClass(label: string) {
  switch (label) {
    case "Erstellt":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Ausstehend":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Fehlgeschlagen":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "Manuell":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getMeetingUrl(externalMeetingUrl: string | null, teamsJoinUrl: string | null, onlineMeetingUrl: string | null) {
  return teamsJoinUrl ?? externalMeetingUrl ?? onlineMeetingUrl ?? null;
}

export default function VereinsleitungMeetingInfoCard({
  title,
  dateLabel,
  timeLabel,
  location,
  onlineMeetingUrl,
  meetingModeLabel,
  meetingProviderLabel,
  teamsSyncStatusLabel,
  externalMeetingUrl,
  teamsJoinUrl,
}: VereinsleitungMeetingInfoCardProps) {
  const meetingUrl = getMeetingUrl(externalMeetingUrl, teamsJoinUrl, onlineMeetingUrl);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Meeting
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getTeamsStatusClass(
            teamsSyncStatusLabel,
          )}`}
        >
          Teams: {teamsSyncStatusLabel}
        </span>
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <Timer className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">{dateLabel}</div>
            <div>{timeLabel}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">Meeting-Typ</div>
            <div>{meetingModeLabel}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Video className="mt-0.5 h-4 w-4 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">Provider</div>
            <div>{meetingProviderLabel}</div>
          </div>
        </div>

        {location ? (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <div className="font-medium text-slate-900">Ort</div>
              <div>{location}</div>
            </div>
          </div>
        ) : null}

        {meetingUrl ? (
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0">
              <div className="font-medium text-slate-900">Meeting-Link</div>
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[#0b4aa2] hover:underline"
              >
                {meetingUrl}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}