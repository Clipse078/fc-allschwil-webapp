import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById } from "@/lib/org/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ArrowLeft, Building2, Users } from "lucide-react";

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
          <Link href="/dashboard/org-units" className="sce-action-secondary px-4 py-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />Zurück
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {unit.children.length > 0 ? (
            <section className="sce-page-card p-6">
              <h3 className="mb-4 sce-kicker">Untereinheiten</h3>
              <div className="space-y-2">
                {unit.children.map((child) => (
                  <Link key={child.id} href={`/dashboard/org-units/${child.id}`}
                    className="sce-list-card flex items-center gap-3 px-4 py-3">
                    <Building2 className="h-4 w-4 shrink-0 text-[var(--sce-subtle)]" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--sce-heading)]">{child.name}</p>
                      <p className="text-[11px] text-[var(--sce-muted)]">{TYPE_LABELS[child.type] ?? child.type} · {child.key}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="sce-page-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--sce-primary-strong)]" />
                <h3 className="sce-kicker">Mitglieder</h3>
              </div>
              <span className="sce-chip px-2.5 py-1 text-[11px]">
                {unit.memberships.length}
              </span>
            </div>
            {unit.memberships.length === 0 ? (
              <p className="text-[12px] text-[var(--sce-subtle)] italic">Noch keine Mitglieder. POST /api/org-units/{id}/memberships</p>
            ) : (
              <div className="space-y-2">
                {unit.memberships.map((m) => (
                  <div key={m.id} className="rounded-[14px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--sce-foreground)]">
                        {m.userId ? `User: ${m.userId.substring(0, 8)}…` : m.personId ? `Person: ${m.personId.substring(0, 8)}…` : "—"}
                      </p>
                      {m.roleKey ? <p className="mt-0.5 text-[10px] text-[var(--sce-muted)]">{m.roleKey}</p> : null}
                    </div>
                    {m.isPrimary ? <span className="sce-chip sce-chip-primary px-2 py-0.5 text-[10px]">Primär</span> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className="sce-page-card p-5">
            <h3 className="mb-4 sce-kicker">Details</h3>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-[11px] text-[var(--sce-subtle)]">Typ</dt><dd className="font-medium text-[var(--sce-heading)]">{TYPE_LABELS[unit.type] ?? unit.type}</dd></div>
              <div><dt className="text-[11px] text-[var(--sce-subtle)]">Key</dt><dd className="font-mono text-[12px] text-[var(--sce-foreground)]">{unit.key}</dd></div>
              <div><dt className="text-[11px] text-[var(--sce-subtle)]">Ebene</dt><dd className="font-medium text-[var(--sce-heading)]">{unit.level}</dd></div>
              {unit.parent ? <div><dt className="text-[11px] text-[var(--sce-subtle)]">Übergeordnet</dt><dd className="font-medium text-[var(--sce-heading)]">{unit.parent.name}</dd></div> : null}
              {unit.description ? <div><dt className="text-[11px] text-[var(--sce-subtle)]">Beschreibung</dt><dd className="text-[var(--sce-muted)]">{unit.description}</dd></div> : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
