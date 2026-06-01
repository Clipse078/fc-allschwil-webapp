import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ArrowLeft, Building2, Pencil, Users } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  CLUB: "Verein", DIVISION: "Abteilung", DEPARTMENT: "Ressort",
  SUB_DEPARTMENT: "Unterressort", TEAM: "Mannschaft", COMMITTEE: "Ausschuss",
  PROJECT_GROUP: "Projektgruppe", CUSTOM: "Benutzerdefiniert",
};

type PageProps = { params: Promise<{ id: string }> };

function membershipDisplayName(
  membership: NonNullable<Awaited<ReturnType<typeof getOrgUnitById>>>["memberships"][number]
) {
  if (membership.user) {
    return `${membership.user.firstName} ${membership.user.lastName}`;
  }

  if (membership.person) {
    return (
      membership.person.displayName ||
      `${membership.person.firstName} ${membership.person.lastName}`
    );
  }

  if (membership.userId) {
    return `User: ${membership.userId.substring(0, 8)}...`;
  }

  if (membership.personId) {
    return `Person: ${membership.personId.substring(0, 8)}...`;
  }

  return "Nicht zugewiesen";
}

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

          <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#0b4aa2]" />
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mitglieder</h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {unit.memberships.length}
              </span>
            </div>
            {unit.memberships.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">Noch keine Mitglieder. POST /api/org-units/{id}/memberships</p>
            ) : (
              <div className="space-y-2">
                {unit.memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-[14px] border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-medium text-slate-800">
                        {membershipDisplayName(m)}
                      </p>
                      {m.roleKey ? <p className="mt-0.5 text-[10px] text-slate-500">{m.roleKey}</p> : null}
                    </div>
                    {m.isPrimary ? <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primär</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
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
