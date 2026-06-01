import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OrgMembershipManagementCard from "@/components/admin/org/OrgMembershipManagementCard";
import { ArrowLeft, Building2, Pencil } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein", DIVISION: "Abteilung", DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort", TEAM: "Mannschaft", COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe", CUSTOM: "Benutzerdefiniert",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function OrgUnitDetailPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const { id } = await params;
  const unit = await getOrgUnitById(id);
  if (!unit) notFound();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Organisation"
        title={unit.name}
        description={`${TYPE_LABELS[unit.type] ?? unit.type} · ${unit.key}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/org-units/${unit.id}/edit`} className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#08357a]">
              <Pencil className="h-4 w-4" />Bearbeiten
            </Link>
            <Link href="/dashboard/org-units" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />Zurück
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {unit.children.length > 0 ? (
            <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Untereinheiten</h3>
              <div className="space-y-2">
                {unit.children.map((child) => (
                  <Link key={child.id} href={`/dashboard/org-units/${child.id}`}
                    className="flex items-center gap-3 rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-white">
                    <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                      <p className="text-[11px] text-slate-500">{TYPE_LABELS[child.type] ?? child.type} · {child.key}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <OrgMembershipManagementCard
            orgUnitId={unit.id}
            initialMemberships={unit.memberships}
          />
        </div>

        <aside>
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Details</h3>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-[11px] text-slate-400">Typ</dt><dd className="font-medium text-slate-900">{TYPE_LABELS[unit.type] ?? unit.type}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Key</dt><dd className="font-mono text-[12px] text-slate-800">{unit.key}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Ebene</dt><dd className="font-medium text-slate-900">{unit.level}</dd></div>
              {unit.parent ? <div><dt className="text-[11px] text-slate-400">Übergeordnet</dt><dd className="font-medium text-slate-900">{unit.parent.name}</dd></div> : null}
              {unit.description ? <div><dt className="text-[11px] text-slate-400">Beschreibung</dt><dd className="text-slate-600">{unit.description}</dd></div> : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
