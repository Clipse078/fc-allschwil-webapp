import Link from "next/link";
import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";

const QUICK_LINKS = [
  {
    title: "Cockpit",
    description: "KPIs und Pendenzen zentral steuern",
    href: "/vereinsleitung/cockpit",
  },
  {
    title: "Meetings",
    description: "Sitzungen und spätere Pendenzen-Übernahme",
    href: "/vereinsleitung/meetings",
  },
  {
    title: "Initiativen",
    description: "Roadmap, Timeline und strategische Themen",
    href: "/vereinsleitung/initiativen",
  },
] as const;

export default function VereinsleitungDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="fca-eyebrow">Vereinsleitung</p>
            <h2 className="mt-2 text-[1.6rem] font-semibold tracking-[-0.02em] text-slate-900">
              Strategische Übersicht
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Übersicht für Ziele, KPI, Pendenzen, Meetings und Initiativen.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="text-sm font-semibold text-[#0b4aa2]">{item.title}</div>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungGoalsCard />
        <VereinsleitungKpiCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungInitiativesCard />
        <VereinsleitungMeetingsCard />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungTasksCard />
        <VereinsleitungDecisionsCard />
      </section>
    </div>
  );
}
