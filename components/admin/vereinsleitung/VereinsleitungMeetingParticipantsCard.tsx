import { Users } from "lucide-react";

type VereinsleitungMeetingParticipantsCardProps = {
  slug: string;
};

const PARTICIPANTS = [
  {
    name: "Michael Weber",
    role: "Präsident",
    initials: "MW",
    status: "Anwesend",
  },
  {
    name: "Sarah Meier",
    role: "Finanzen",
    initials: "SM",
    status: "Anwesend",
  },
  {
    name: "Thomas Schmid",
    role: "Sportlicher Leiter",
    initials: "TS",
    status: "Anwesend",
  },
  {
    name: "Elena Rossi",
    role: "Juniorenfussball",
    initials: "ER",
    status: "Entschuldigt",
  },
  {
    name: "David Keller",
    role: "Aktuar",
    initials: "DK",
    status: "Anwesend",
  },
];

function getStatusClass(status: string) {
  switch (status) {
    case "Anwesend":
      return "text-emerald-700";
    case "Entschuldigt":
      return "text-slate-500";
    default:
      return "text-slate-500";
  }
}

export default function VereinsleitungMeetingParticipantsCard({
  slug,
}: VereinsleitungMeetingParticipantsCardProps) {
  const title = slug === "vorstandssitzung-april" ? "Teilnehmer" : "Teilnehmer";

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          4 / 5
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {PARTICIPANTS.map((participant) => (
          <div key={participant.name} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[11px] font-semibold text-[#0b4aa2]">
                {participant.initials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {participant.name}
                </p>
                <p className="truncate text-xs text-slate-500">{participant.role}</p>
              </div>
            </div>

            <span className={`shrink-0 text-xs font-semibold ${getStatusClass(participant.status)}`}>
              {participant.status}
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
