import { CalendarDays, Clock3, MapPin, Video } from "lucide-react";

type VereinsleitungMeetingInfoCardProps = {
  slug: string;
};

export default function VereinsleitungMeetingInfoCard({
  slug,
}: VereinsleitungMeetingInfoCardProps) {
  const meetingTitle =
    slug === "vorstandssitzung-april" ? "Sitzungsinformationen" : "Sitzungsinformationen";

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <h3 className="text-[1.08rem] font-semibold text-slate-900">{meetingTitle}</h3>

      <div className="mt-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Datum</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Dienstag, 16. April 2024</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
            <Clock3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Zeit</p>
            <p className="mt-1 text-sm font-medium text-slate-900">20:00 - 21:00 Uhr</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Ort</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Clubhaus, Sitzungszimmer 1</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Online Teilnahme</p>
            <button
              type="button"
              className="mt-1 text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
            >
              Microsoft Teams Link öffnen
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
