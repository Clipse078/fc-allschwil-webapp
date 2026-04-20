import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type InitiativeTask = {
  title: string;
  dueDate: string;
  owner: string;
  completed?: boolean;
};

type MeetingPreview = {
  dateLabel: string;
  title: string;
  meta: string;
};

type DecisionPreview = {
  title: string;
  date: string;
  tag: string;
  status: string;
};

const INITIATIVE = {
  title: "Website Relaunch",
  subtitle: "Initiativen Details",
  description:
    "Der aktuelle Webauftritt des FC Allschwil ist technisch veraltet, nicht mobil-optimiert und repräsentiert den Verein nicht mehr zeitgemäss. Ziel dieser Initiative ist die Konzeption, Gestaltung und Entwicklung einer neuen, modernen Website, die als zentraler Kommunikationskanal für Mitglieder, Fans und Sponsoren dient.",
  owner: "Michael Weber",
  ownerRole: "Leiter Kommunikation",
  status: "In Arbeit",
  startDate: "01.03.2024",
  targetDate: "30.09.2024",
  progress: 65,
};

const TASKS: InitiativeTask[] = [
  {
    title: "Design-Entwürfe überprüfen und freigeben",
    dueDate: "15.05.2024",
    owner: "Michael Weber",
  },
  {
    title: "Inhalte (Texte & Bilder) der alten Seite migrieren",
    dueDate: "22.05.2024",
    owner: "Sarah Kern",
  },
  {
    title: "Auswahl der Web-Agentur abschliessen",
    dueDate: "10.04.2024",
    owner: "Vorstand",
    completed: true,
  },
];

const NEXT_MEETINGS: MeetingPreview[] = [
  {
    dateLabel: "MAI 18",
    title: "Review: Erste Design-Scribbles mit Agent",
    meta: "14:00 - 15:30 · 4 Teilnehmer",
  },
];

const DECISIONS: DecisionPreview[] = [
  {
    title: "Budgetfreigabe für Entwicklungsphase (CHF 15'000)",
    date: "12.04.2024",
    tag: "Budget",
    status: "Freigegeben",
  },
  {
    title: "Wahl des CMS: WordPress (Headless Setup)",
    date: "28.03.2024",
    tag: "Technologie",
    status: "Freigegeben",
  },
];

export default async function VereinsleitungInitiativenPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_INITIATIVES_READ);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title={INITIATIVE.title}
        description={INITIATIVE.subtitle}
        actions={
          <>
            <button type="button" className="fca-button-secondary">
              Bearbeiten
            </button>
            <button type="button" className="fca-button-primary">
              Neue Aufgabe
            </button>
          </>
        }
      />

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.75fr)]">
          <div>
            <h3 className="text-[1.45rem] font-semibold text-slate-900">
              Projektbeschreibung
            </h3>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700">
              {INITIATIVE.description}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {INITIATIVE.status}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-sm font-semibold text-[#0b4aa2]">
                MW
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">{INITIATIVE.owner}</div>
                <div className="mt-1 text-xs text-slate-500">{INITIATIVE.ownerRole}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">
              Fortschritt ({INITIATIVE.progress}%)
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Start: {INITIATIVE.startDate}</span>
              <span>Ziel: {INITIATIVE.targetDate}</span>
            </div>
          </div>

          <div className="mt-3 h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-[#0b4aa2]"
              style={{ width: `${INITIATIVE.progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="flex flex-wrap gap-8 text-sm font-medium text-slate-500">
          <button type="button" className="border-b-2 border-[#0b4aa2] pb-3 text-[#0b4aa2]">
            Übersicht
          </button>
          <button type="button" className="pb-3 transition hover:text-slate-900">
            Aufgaben
          </button>
          <button type="button" className="pb-3 transition hover:text-slate-900">
            Meetings
          </button>
          <button type="button" className="pb-3 transition hover:text-slate-900">
            Entscheidungen
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Aktuelle Aufgaben
            </h3>
            <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
              Alle anzeigen
            </button>
          </div>

          <div className="space-y-3">
            {TASKS.map((task) => (
              <article
                key={task.title}
                className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {task.completed ? <span className="line-through text-slate-400">{task.title}</span> : task.title}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>{task.dueDate}</span>
                  <span>{task.owner}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[1.08rem] font-semibold text-slate-900">
                Nächste Meetings
              </h3>
              <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                Kalender
              </button>
            </div>

            <div className="space-y-3">
              {NEXT_MEETINGS.map((meeting) => (
                <article
                  key={meeting.title}
                  className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-[#0b4aa2]">
                    <span className="text-[10px] font-semibold uppercase leading-none">
                      {meeting.dateLabel.split(" ")[0]}
                    </span>
                    <span className="mt-1 text-lg font-bold leading-none">
                      {meeting.dateLabel.split(" ")[1]}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{meeting.title}</div>
                    <div className="mt-2 text-xs text-slate-500">{meeting.meta}</div>
                  </div>

                  <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                    Details
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[1.08rem] font-semibold text-slate-900">
                Letzte Entscheidungen
              </h3>
              <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">
                Protokoll
              </button>
            </div>

            <div className="space-y-3">
              {DECISIONS.map((decision) => (
                <article
                  key={decision.title}
                  className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {decision.title}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{decision.date}</span>
                        <span>{decision.tag}</span>
                      </div>
                    </div>

                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {decision.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
