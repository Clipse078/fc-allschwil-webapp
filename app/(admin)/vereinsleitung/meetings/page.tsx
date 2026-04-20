import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type ParticipantStatus = "ANWESEND" | "ENTSCHULDIGT" | "OFFEN";

type Participant = {
  name: string;
  role: string;
  initials: string;
  status: ParticipantStatus;
};

type AgendaItem = {
  index: number;
  title: string;
  owner: string;
  duration: string;
  content: string;
};

type Decision = {
  title: string;
  status: string;
  description: string;
  owner: string;
};

type ActionItem = {
  title: string;
  dueDate: string;
  owner: string;
  completed: boolean;
};

const MEETING = {
  title: "Vorstandssitzung April",
  subtitle: "Protokoll & Beschlüsse",
  date: "Dienstag, 16. April 2024",
  time: "19:00 – 21:00 Uhr",
  location: "Clubhaus, Sitzungszimmer 1",
  onlineLabel: "Microsoft Teams Link öffnen",
};

const AGENDA_ITEMS: AgendaItem[] = [
  {
    index: 1,
    title: "Genehmigung Protokoll letzte Sitzung",
    owner: "David Keller",
    duration: "5 Min",
    content:
      "Das Protokoll der März-Sitzung wurde im Voraus verteilt. Keine Einwände aus dem Gremium. Es wird einstimmig verdankt und genehmigt.",
  },
  {
    index: 2,
    title: "Website Relaunch Update",
    owner: "Michael Weber",
    duration: "20 Min",
    content:
      "Agentur hat erste Design-Entwürfe präsentiert. Fokus liegt auf Mobile-First und einfacherer Navigation für Vereinsmitglieder. Feedback-Runde im Vorstand läuft bis Ende Woche. Kritischer Punkt: Integration des bestehenden Spielplansystems muss noch technisch geklärt werden.",
  },
  {
    index: 3,
    title: "Trainerplanung Saison 25/26",
    owner: "Thomas Schmid",
    duration: "30 Min",
    content:
      "Für die 1. Mannschaft gibt es eine mündliche Zusage für eine Vertragsverlängerung. Bei den A-Junioren suchen wir aktuell noch nach einem Co-Trainer. Budget für Trainerausbildung soll leicht erhöht werden, um vereinsinterne Nachwuchstrainer besser zu fördern.",
  },
];

const PARTICIPANTS: Participant[] = [
  { name: "Michael Weber", role: "Präsident", initials: "MW", status: "ANWESEND" },
  { name: "Sarah Meier", role: "Finanzen", initials: "SM", status: "ANWESEND" },
  { name: "Thomas Schmid", role: "Sportlicher Leiter", initials: "TS", status: "ANWESEND" },
  { name: "Elena Rosen", role: "Juniorenfussball", initials: "ER", status: "ENTSCHULDIGT" },
  { name: "David Keller", role: "Aktuar", initials: "DK", status: "ANWESEND" },
];

const DECISIONS: Decision[] = [
  {
    title: "Budgetfreigabe Website-Phase 2",
    status: "Angenommen",
    description: "Freigabe der verbleibenden CHF 5'000 für die technische Umsetzung des Website Relaunches.",
    owner: "Sarah Meier",
  },
  {
    title: "Erhöhung Ausbildungsbudget",
    status: "Angenommen",
    description: "Das jährliche Budget für Trainerausbildungen wird ab nächster Saison um 15% erhöht.",
    owner: "Thomas Schmid",
  },
];

const ACTIONS: ActionItem[] = [
  {
    title: "Feedback zu Website-Designs sammeln und an Agentur senden",
    dueDate: "20.04.2024",
    owner: "Michael Weber",
    completed: false,
  },
  {
    title: "Vertrag 1. Mannschaft aufsetzen",
    dueDate: "25.04.2024",
    owner: "Thomas Schmid",
    completed: true,
  },
  {
    title: "Stellenausschreibung A-Junioren Co-Trainer publizieren",
    dueDate: "30.04.2024",
    owner: "Elena Rosen",
    completed: false,
  },
];

function getParticipantStatusClass(status: ParticipantStatus) {
  switch (status) {
    case "ANWESEND":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ENTSCHULDIGT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default async function VereinsleitungMeetingsPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title={MEETING.title}
        description={MEETING.subtitle}
        actions={
          <>
            <button type="button" className="fca-button-secondary">
              Protokoll exportieren
            </button>
            <button type="button" className="fca-button-primary">
              Beschluss fassen
            </button>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[1.08rem] font-semibold text-slate-900">
                Traktanden & Protokoll
              </h3>
              <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                Alle einklappen
              </button>
            </div>

            <div className="space-y-4">
              {AGENDA_ITEMS.map((item) => (
                <article
                  key={item.index}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-[#0b4aa2]">
                      {item.index}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-base font-semibold text-slate-900">
                            {item.title}
                          </h4>
                          <p className="mt-1 text-sm text-slate-500">{item.owner}</p>
                        </div>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {item.duration}
                        </span>
                      </div>

                      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {item.content}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Gefasste Beschlüsse
            </h3>

            <div className="mt-5 space-y-4">
              {DECISIONS.map((decision) => (
                <article
                  key={decision.title}
                  className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {decision.title}
                      </h4>
                      <p className="mt-2 text-sm text-slate-600">{decision.description}</p>
                    </div>

                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {decision.status}
                    </span>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Verantwortlich: {decision.owner}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[1.08rem] font-semibold text-slate-900">
                Neue Massnahmen
              </h3>
              <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                Massnahme hinzufügen
              </button>
            </div>

            <div className="space-y-3">
              {ACTIONS.map((action) => (
                <label
                  key={action.title}
                  className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={action.completed}
                    readOnly
                    className="h-4 w-4 rounded border-slate-300 text-[#0b4aa2] focus:ring-[#0b4aa2]"
                  />

                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${action.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {action.title}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Bis {action.dueDate}
                  </div>

                  <div className="shrink-0 text-xs text-slate-500">{action.owner}</div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Sitzungsinformationen
            </h3>

            <div className="mt-5 space-y-4">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Datum</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{MEETING.date}</div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Zeit</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{MEETING.time}</div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Ort</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{MEETING.location}</div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Online Teilnahme</div>
                <Link href="#" className="mt-2 inline-block text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                  {MEETING.onlineLabel}
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[1.08rem] font-semibold text-slate-900">
                Teilnehmer
              </h3>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {PARTICIPANTS.filter((item) => item.status === "ANWESEND").length}/{PARTICIPANTS.length}
              </div>
            </div>

            <div className="space-y-3">
              {PARTICIPANTS.map((participant) => (
                <article
                  key={participant.name}
                  className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-xs font-semibold text-[#0b4aa2]">
                      {participant.initials}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {participant.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{participant.role}</div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getParticipantStatusClass(
                      participant.status,
                    )}`}
                  >
                    {participant.status}
                  </span>
                </article>
              ))}
            </div>

            <button type="button" className="mt-5 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Teilnehmer verwalten
            </button>
          </section>
        </div>
      </section>
    </div>
  );
}
