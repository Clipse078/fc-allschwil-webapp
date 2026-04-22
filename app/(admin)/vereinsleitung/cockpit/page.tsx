import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OpenMattersList from "@/components/vereinsleitung/OpenMattersList";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type CockpitKpiItem = {
  label: string;
  value: string;
  note: string;
};

function PremiumKpiCard({ item }: { item: CockpitKpiItem }) {
  return (
    <article className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
      <div className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {item.label}
        </p>
        <p className="mt-4 text-[2.4rem] font-semibold leading-none tracking-tight text-slate-900">
          {item.value}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-500">{item.note}</p>
      </div>
    </article>
  );
}

export default async function VereinsleitungCockpitPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_COCKPIT_READ);

  const [activePeopleCount, activeTeamsCount, activeTrainerCount, openMattersCount] =
    await Promise.all([
      prisma.person.count({
        where: {
          isActive: true,
        },
      }),
      prisma.team.count({
        where: {
          isActive: true,
        },
      }),
      prisma.person.count({
        where: {
          isActive: true,
          isTrainer: true,
        },
      }),
      prisma.vereinsleitungMatter.count({
        where: {
          status: {
            not: "DONE",
          },
        },
      }),
    ]);

  const kpiItems: CockpitKpiItem[] = [
    {
      label: "Aktive Personen",
      value: String(activePeopleCount),
      note: "Alle aktiven Personenprofile im System.",
    },
    {
      label: "Aktive Teams",
      value: String(activeTeamsCount),
      note: "Aktuell geführte Teams im Vereinsbetrieb.",
    },
    {
      label: "Trainer & Betreuer",
      value: String(activeTrainerCount),
      note: "Aktive Trainer- und Betreuerprofile.",
    },
    {
      label: "Offene Pendenzen",
      value: String(openMattersCount),
      note: "Noch nicht erledigte oder abgeschlossene Pendenzen.",
    },
  ];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Cockpit"
        description="Zentrale Übersicht über Kennzahlen, Vereinsaktivität und offene Themen."
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((item) => (
          <PremiumKpiCard key={item.label} item={item} />
        ))}
      </section>

      <section
        id="offene-themen"
        className="overflow-hidden scroll-mt-24 rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

        <div className="p-6 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
                Pendenzen
              </p>
              <h3 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">
                Offene Themen
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Hier siehst du die aktuell offenen Pendenzen der Vereinsleitung in einer zentralen Übersicht.
              </p>
            </div>

            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Live-Übersicht
            </div>
          </div>

          <div className="mt-6">
            <OpenMattersList />
          </div>
        </div>
      </section>
    </div>
  );
}
