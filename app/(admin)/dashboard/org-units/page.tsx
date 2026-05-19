import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein", DIVISION: "Abteilung", DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort", TEAM: "Mannschaft", COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe", CUSTOM: "Benutzerdefiniert",
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-amber-200 bg-amber-50 text-amber-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

export default async function OrgUnitsPage() {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const orgUnits = await getOrgUnits();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Organisation"
        title="Organisationseinheiten"
        description="Organigramm-Grundlage für Sichtbarkeit, Kommunikation und Workflow-Routing."
        actions={
          <Link href="/dashboard/org-units/new" className="inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#08357a]">
            <Plus className="h-4 w-4" />Neue Einheit
          </Link>
        }
      />

      {orgUnits.length === 0 ? (
        <section className="rounded-[30px] border border-slate-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h3 className="text-[1.05rem] font-semibold text-slate-900">Noch keine Organisationseinheiten</h3>
          <p className="mt-2 text-sm text-slate-500">Erstelle die erste Einheit — z.B. Verein, Abteilung oder Ausschuss.</p>
          <Link href="/dashboard/org-units/new" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#08357a]">
            <Plus className="h-4 w-4" />Erste Einheit erstellen
          </Link>
        </section>
      ) : (
        <div className="space-y-2">
          {orgUnits.map((unit) => (
            <Link key={unit.id} href={`/dashboard/org-units/${unit.id}`}
              className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px] hover:shadow-md"
              style={{ paddingLeft: `${20 + unit.level * 28}px` }}>
              <div className="flex min-w-0 items-center gap-3">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{unit.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {TYPE_LABELS[unit.type] ?? unit.type}
                    {" · "}
                    <code className="font-mono">{unit.key}</code>
                    {" · "}
                    {unit._count.memberships} Mitgl.
                    {unit._count.children > 0 ? ` · ${unit._count.children} Untereinheiten` : ""}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${STATUS_CLASSES[unit.status] ?? STATUS_CLASSES.ACTIVE}`}>
                {unit.status === "ACTIVE" ? "Aktiv" : unit.status === "INACTIVE" ? "Inaktiv" : "Archiviert"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
