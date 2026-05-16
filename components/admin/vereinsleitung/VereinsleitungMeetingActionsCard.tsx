import { CalendarDays, Circle, PlusCircle } from "lucide-react";

type VereinsleitungMeetingActionsCardProps = {
  slug: string;
};

const ACTIONS = [
  {
    title: "Feedback zu Website-Designs sammeln und an Agentur senden",
    ownerInitials: "MW",
    due: "Bis 20.04.2024",
    completed: false,
  },
  {
    title: "Vertrag 1. Mannschaft aufsetzen",
    ownerInitials: "TS",
    due: "Bis 25.04.2024",
    completed: true,
  },
  {
    title: "Stellenausschreibung A-Junioren Co-Trainer publizieren",
    ownerInitials: "DK",
    due: "Bis 30.04.2024",
    completed: false,
  },
];

export default function VereinsleitungMeetingActionsCard({
  slug,
}: VereinsleitungMeetingActionsCardProps) {
  const title = slug === "vorstandssitzung-april" ? "Neue Massnahmen" : "Neue Massnahmen";

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>

      <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
        {ACTIONS.map((action) => (
          <div
            key={action.title}
            className="flex items-start gap-4 px-4 py-4 transition hover:bg-slate-50/70"
          >
            <button
              type="button"
              aria-label={`${action.title} auswählen`}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                action.completed
                  ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                  : "border-slate-300 bg-white text-slate-400"
              }`}
            >
              <Circle className="h-3.5 w-3.5" />
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold leading-5 ${
                  action.completed ? "text-slate-400 line-through" : "text-slate-900"
                }`}
              >
                {action.title}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                {action.ownerInitials}
              </span>

              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                <CalendarDays className="h-3.5 w-3.5" />
                {action.due}
              </span>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <PlusCircle className="h-4 w-4" />
          Massnahme hinzufügen
        </button>
      </div>
    </section>
  );
}
