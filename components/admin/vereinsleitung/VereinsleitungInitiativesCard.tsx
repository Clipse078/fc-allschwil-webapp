import { Flag, MapPin, MoreHorizontal, TrendingUp } from "lucide-react";

const INITIATIVES = [
  {
    title: "Website Relaunch",
    owner: "Michael S.",
    ownerInitials: "MS",
    status: "In Arbeit",
    progress: 60,
    icon: Flag,
  },
  {
    title: "Neues Clubhaus Konzept",
    owner: "Sarah W.",
    ownerInitials: "SW",
    status: "Geplant",
    progress: 10,
    icon: MapPin,
  },
  {
    title: "Sponsorenlauf 2025",
    owner: "Thomas K.",
    ownerInitials: "TK",
    status: "On Track",
    progress: 80,
    icon: TrendingUp,
  },
];

function getStatusClass(status: string) {
  switch (status) {
    case "In Arbeit":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Geplant":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "On Track":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungInitiativesCard() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Laufende Initiativen
          </h3>
        </div>

        <button
          type="button"
          className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
        >
          Alle ansehen
        </button>
      </div>

      <div className="mt-6 space-y-3.5">
        {INITIATIVES.map((initiative) => {
          const Icon = initiative.icon;

          return (
            <div
              key={initiative.title}
              className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#0b4aa2]">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {initiative.title}
                      </p>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                          initiative.status,
                        )}`}
                      >
                        {initiative.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                        {initiative.ownerInitials}
                      </div>
                      <p className="text-xs text-slate-500">{initiative.owner}</p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-start gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {initiative.progress}%
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">Fortschritt</p>
                  </div>

                  <button
                    type="button"
                    aria-label="Mehr Optionen"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[#0b4aa2]"
                  style={{ width: `${initiative.progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
