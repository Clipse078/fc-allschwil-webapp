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
      note: "aktive Personen im System",
    },
    {
      label: "Aktive Teams",
      value: String(activeTeamsCount),
      note: "aktive Teams im System",
    },
    {
      label: "Trainer & Betreuer",
      value: String(activeTrainerCount),
      note: "aktive Trainerprofile",
    },
    {
      label: "Offene Pendenzen",
      value: String(openMattersCount),
      note: "nicht erledigte Pendenzen",
    },
  ];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title="Cockpit"
        description="Übersicht über Kennzahlen und offene Themen im Verein"
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpiItems.map((item) => (
          <article
            key={item.label}
            className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-[2rem] font-bold leading-none text-slate-900">
              {item.value}
            </p>
            <p className="mt-3 text-xs text-slate-400">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Offene Themen</h3>
        <OpenMattersList />
      </section>
    </div>
  );
}
