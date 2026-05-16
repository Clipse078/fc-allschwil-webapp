import { Clock3, FileText } from "lucide-react";

type VereinsleitungMeetingAgendaCardProps = {
  slug: string;
};

const ITEMS = [
  {
    number: 1,
    title: "Genehmigung Protokoll letzte Sitzung",
    owner: "David Keller",
    ownerInitials: "DK",
    duration: "5 Min",
    notes:
      "Das Protokoll der März-Sitzung wurde im Voraus verteilt. Keine Einwände aus dem Gremium. Es wird einstimmig verdankt und genehmigt.",
  },
  {
    number: 2,
    title: "Website Relaunch Update",
    owner: "Michael Weber",
    ownerInitials: "MW",
    duration: "20 Min",
    notes:
      "Agentur hat erste Design-Entwürfe präsentiert. Fokus liegt auf Mobile-First und einfacherer Navigation für Vereinsmitglieder. Feedback-Runde im Vorstand läuft bis Ende Woche. Kritischer Punkt: Integration des bestehenden Spielplansystems muss noch technisch geklärt werden.",
  },
  {
    number: 3,
    title: "Trainerplanung Saison 25/26",
    owner: "Thomas Schmid",
    ownerInitials: "TS",
    duration: "30 Min",
    notes:
      "Für die 1. Mannschaft gibt es eine mündliche Zusage für eine Vertragsverlängerung. Bei den A-Junioren suchen wir aktuell noch nach einem Co-Trainer. Budget für Trainerausbildung soll leicht erhöht werden, um vereinsinterne Nachwuchstrainer besser zu fördern.",
  },
];

export default function VereinsleitungMeetingAgendaCard({
  slug,
}: VereinsleitungMeetingAgendaCardProps) {
  const title =
    slug === "vorstandssitzung-april" ? "Traktanden & Protokoll" : "Traktanden & Protokoll";

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
        </div>

        <button
          type="button"
          className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
        >
          Alle einklappen
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {ITEMS.map((item) => (
          <article
            key={item.number}
            className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-sm font-semibold text-[#0b4aa2]">
                {item.number}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[1rem] font-semibold text-slate-900">
                      {item.title}
                    </h4>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                        {item.ownerInitials}
                      </div>
                      <p className="text-xs text-slate-500">{item.owner}</p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{item.duration}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  {item.notes}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
