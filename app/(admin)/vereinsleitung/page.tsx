import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type Kennzahl = {
  label: string;
  value: string;
  delta: string;
  note: string;
};

type OpenTopic = {
  title: string;
  owner: string;
  dueDate: string;
  priority?: string;
  status: "Offen" | "In Arbeit" | "Blockiert";
};

const KENNZAHLEN: Kennzahl[] = [
  {
    label: "Aktive Mitglieder",
    value: "452",
    delta: "+12",
    note: "vs. Vorjahr",
  },
  {
    label: "Gemeldete Teams",
    value: "24",
    delta: "+2",
    note: "vs. Vorjahr",
  },
  {
    label: "Trainer & Betreuer",
    value: "45",
    delta: "0",
    note: "vs. Vorjahr",
  },
  {
    label: "Offene Pendenzen",
    value: "17",
    delta: "-3",
    note: "seit letzter Sitzung",
  },
];

const OPEN_TOPICS: OpenTopic[] = [
  {
    title: "Go-Live Planung Website finalisieren",
    owner: "Michael S.",
    dueDate: "24.04.2026",
    priority: "High Prio",
    status: "In Arbeit",
  },
  {
    title: "Budget 2026/27 für Vereinsleitung vorbereiten",
    owner: "Thomas K.",
    dueDate: "26.04.2026",
    status: "Offen",
  },
  {
    title: "Trainerbedarf Saison 2026/27 abstimmen",
    owner: "Sarah W.",
    dueDate: "29.04.2026",
    status: "Offen",
  },
  {
    title: "Sponsoring-Pipeline Q2 reviewen",
    owner: "Scotty M.",
    dueDate: "30.04.2026",
    status: "Blockiert",
  },
];

function getStatusClass(status: OpenTopic["status"]) {
  switch (status) {
    case "In Arbeit":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Blockiert":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default async function Page() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_READ);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Vereinsleitung"
        description="Kennzahlen und offene Themen der Vereinsleitung."
        actions={
          <>
            <Link href="/vereinsleitung/meetings" className="fca-button-secondary">
              Meetings
            </Link>
            <Link href="/vereinsleitung/initiativen" className="fca-button-primary">
              Initiativen
            </Link>
          </>
        }
      />

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Kennzahlen
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {KENNZAHLEN.map((item) => (
            <article
              key={item.label}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-3 text-[2rem] font-bold leading-none text-slate-900">
                {item.value}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.delta}
                </span>
                <span className="text-xs text-slate-400">{item.note}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[1.08rem] font-semibold text-slate-900">
              Offene Themen
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Übersicht der aktuell offenen Pendenzen und Fokusthemen.
            </p>
          </div>

          <button type="button" className="fca-button-secondary">
            Thema erfassen
          </button>
        </div>

        <div className="space-y-3">
          {OPEN_TOPICS.map((topic) => (
            <article
              key={topic.title}
              className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {topic.title}
                  </h4>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Verantwortlich: {topic.owner}</span>
                    <span>Fällig: {topic.dueDate}</span>
                    {topic.priority ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-600">
                        {topic.priority}
                      </span>
                    ) : null}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                    topic.status,
                  )}`}
                >
                  {topic.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
