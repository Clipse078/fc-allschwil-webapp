import { CheckCircle2 } from "lucide-react";

type VereinsleitungMeetingDecisionsCardProps = {
  slug: string;
};

const DECISIONS = [
  {
    title: "Budgetfreigabe Website-Phase 2",
    status: "Angenommen",
    description:
      "Freigabe der verbleibenden CHF 5'000 für die technische Umsetzung des Website Relaunches.",
    owner: "Sarah Meier",
    ownerInitials: "SM",
  },
  {
    title: "Erhöhung Ausbildungsbudget",
    status: "Angenommen",
    description:
      "Das jährliche Budget für Trainerausbildungen wird ab nächster Saison um 15% erhöht.",
    owner: "Thomas Schmid",
    ownerInitials: "TS",
  },
];

export default function VereinsleitungMeetingDecisionsCard({
  slug,
}: VereinsleitungMeetingDecisionsCardProps) {
  const title = slug === "vorstandssitzung-april" ? "Gefasste Beschlüsse" : "Gefasste Beschlüsse";

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
      </div>

      <div className="mt-6 space-y-4">
        {DECISIONS.map((decision) => (
          <article
            key={decision.title}
            className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-[1rem] font-semibold text-slate-900">
                  {decision.title}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {decision.description}
                </p>
              </div>

              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {decision.status}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
              <span>Verantwortlich:</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                {decision.ownerInitials}
              </span>
              <span className="font-medium text-slate-700">{decision.owner}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
