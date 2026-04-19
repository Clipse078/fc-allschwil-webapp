import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type MeetingParticipantStatus = "BESTAETIGT" | "OFFEN" | "ABGELEHNT" | "NEUER_TERMIN_VORGESCHLAGEN";

type MeetingParticipant = {
  name: string;
  initials: string;
  role: string;
  status: MeetingParticipantStatus;
};

type MeetingPendenz = {
  title: string;
  owner: string;
  dueDate: string;
  status: "OFFEN" | "IN_ARBEIT" | "ERLEDIGT";
};

type Meeting = {
  id: string;
  title: string;
  dateLabel: string;
  location: string;
  status: "GEPLANT" | "BESTAETIGT" | "IN_VORBEREITUNG";
  participants: MeetingParticipant[];
  nextMeetingPendenzen: MeetingPendenz[];
  decisions: string[];
};

const MEETINGS: Meeting[] = [
  {
    id: "meeting-1",
    title: "Vorstandssitzung Mai",
    dateLabel: "06.05.2026 · 19:00 Uhr",
    location: "Clubhaus FC Allschwil",
    status: "BESTAETIGT",
    participants: [
      { name: "Michael S.", initials: "MS", role: "Projekt / Website", status: "BESTAETIGT" },
      { name: "Scotty M.", initials: "SM", role: "Praesident", status: "BESTAETIGT" },
      { name: "Sarah W.", initials: "SW", role: "Vereinsleitung", status: "OFFEN" },
      { name: "Thomas K.", initials: "TK", role: "Finanzen", status: "NEUER_TERMIN_VORGESCHLAGEN" },
    ],
    nextMeetingPendenzen: [
      { title: "Budgetupdate vorbereiten", owner: "Thomas K.", dueDate: "04.05.2026", status: "IN_ARBEIT" },
      { title: "Go-Live Status Website vorbereiten", owner: "Michael S.", dueDate: "05.05.2026", status: "OFFEN" },
      { title: "Sponsoring Pipeline ueberarbeiten", owner: "Sarah W.", dueDate: "05.05.2026", status: "OFFEN" },
    ],
    decisions: [
      "Go-Live Planung Website als prioritaeres Thema aufnehmen",
      "Trainingsplan Modul fuer Go-Live Scope hoch priorisieren",
    ],
  },
  {
    id: "meeting-2",
    title: "Sportkommission Rapport",
    dateLabel: "20.05.2026 · 18:30 Uhr",
    location: "Sitzungszimmer Bruehl",
    status: "GEPLANT",
    participants: [
      { name: "Scotty M.", initials: "SM", role: "Praesident", status: "BESTAETIGT" },
      { name: "Loris V.", initials: "LV", role: "Trainer", status: "OFFEN" },
      { name: "Adrian D.", initials: "AD", role: "Koordinator", status: "BESTAETIGT" },
    ],
    nextMeetingPendenzen: [
      { title: "Trainerverfuegbarkeiten fuer Sommer erfassen", owner: "Adrian D.", dueDate: "15.05.2026", status: "OFFEN" },
      { title: "Winterhallenplanung vorbereiten", owner: "Loris V.", dueDate: "18.05.2026", status: "OFFEN" },
    ],
    decisions: [
      "Rueckrunde Evaluation strukturiert vorbereiten",
    ],
  },
];

function getMeetingStatusClass(status: Meeting["status"]) {
  switch (status) {
    case "BESTAETIGT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_VORBEREITUNG":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getParticipantStatusClass(status: MeetingParticipantStatus) {
  switch (status) {
    case "BESTAETIGT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ABGELEHNT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NEUER_TERMIN_VORGESCHLAGEN":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPendenzStatusClass(status: MeetingPendenz["status"]) {
  switch (status) {
    case "ERLEDIGT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_ARBEIT":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getSummaryCounts(meeting: Meeting) {
  return {
    total: meeting.participants.length,
    confirmed: meeting.participants.filter((participant) => participant.status === "BESTAETIGT").length,
    open: meeting.participants.filter((participant) => participant.status === "OFFEN").length,
    proposed: meeting.participants.filter((participant) => participant.status === "NEUER_TERMIN_VORGESCHLAGEN").length,
    declined: meeting.participants.filter((participant) => participant.status === "ABGELEHNT").length,
  };
}

export default async function VereinsleitungMeetingsPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Meetings"
        description="Erste Meetings-Planungsansicht mit Teilnehmerstatus, naechsten Pendenzen und Entscheidungsuebersicht."
        actions={
          <>
            <button type="button" className="fca-button-secondary">
              Pendenzen uebernehmen
            </button>
            <button type="button" className="fca-button-primary">
              Meeting erfassen
            </button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {MEETINGS.map((meeting) => {
          const summary = getSummaryCounts(meeting);

          return (
            <article
              key={meeting.id}
              className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[1.08rem] font-semibold text-slate-900">
                    {meeting.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{meeting.dateLabel}</p>
                  <p className="mt-1 text-sm text-slate-500">{meeting.location}</p>
                </div>

                <span
                  className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${getMeetingStatusClass(
                    meeting.status,
                  )}`}
                >
                  {meeting.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Teilnehmer</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total}</p>
                </div>

                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Bestaetigt</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-800">{summary.confirmed}</p>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Offen</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.open}</p>
                </div>

                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Neuer Termin</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-800">{summary.proposed}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Einladungen & Zusagen</h3>
                    <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                      Teilnehmer verwalten
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {meeting.participants.map((participant) => (
                      <div
                        key={meeting.id + "-" + participant.name}
                        className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-xs font-semibold text-[#0b4aa2]">
                            {participant.initials}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {participant.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">{participant.role}</p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getParticipantStatusClass(
                            participant.status,
                          )}`}
                        >
                          {participant.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Pendenzen fuer dieses Meeting</h3>
                    <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                      Aus vorherigem Meeting uebernehmen
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {meeting.nextMeetingPendenzen.map((pendenz) => (
                      <div
                        key={meeting.id + "-" + pendenz.title}
                        className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{pendenz.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {pendenz.owner} · Faellig {pendenz.dueDate}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPendenzStatusClass(
                              pendenz.status,
                            )}`}
                          >
                            {pendenz.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Beschluesse / Fokus fuer die Sitzung</h3>
                  <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    Sitzung vorbereiten
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {meeting.decisions.map((decision) => (
                    <div
                      key={meeting.id + "-" + decision}
                      className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {decision}
                    </div>
                  ))}
                </div>
              </section>
            </article>
          );
        })}
      </section>
    </div>
  );
}
