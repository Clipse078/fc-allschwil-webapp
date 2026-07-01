import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Target, Users } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTargetGroups } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { EmptyState } from "@/components/ui/page";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

function getStatusTone(status: string): "success" | "muted" | "default" {
  if (status === "ACTIVE") return "success";
  return "muted";
}

export default async function TargetGroupsPage() {
  const session = await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const tenant = await getTenantFromSession(session.user?.tenantId);
  if (!tenant) notFound();
  const targetGroups = await getTargetGroups(tenant.id);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Organisation"
        title="Zielgruppen"
        description="Benannte, wiederverwendbare Gruppen für Sichtbarkeit, Kommunikation und Workflow-Routing."
        actions={
          <Link href="/dashboard/target-groups/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue Zielgruppe
          </Link>
        }
      />

      {targetGroups.length === 0 ? (
        <div className="sce-detail-section">
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            heading="Noch keine Zielgruppen"
            description="Zielgruppen definieren Mitgliedergruppen für Sichtbarkeit, Kommunikation und Workflow-Routing."
            action={
              <Link href="/dashboard/target-groups/new" className="fca-button-primary">
                <Plus className="h-4 w-4" />
                Erste Zielgruppe erstellen
              </Link>
            }
          />
        </div>
      ) : (
        <div className="sce-detail-section">
          <div className="divide-y divide-[var(--border)]">
            {targetGroups.map((tg) => (
              <Link
                key={tg.id}
                href={`/dashboard/target-groups/${tg.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)]"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)]">
                  <Target className="h-4 w-4 text-[var(--muted)]" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{tg.name}</p>
                    <AdminStatusPill
                      label={STATUS_LABELS[tg.status] ?? tg.status}
                      tone={getStatusTone(tg.status)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="text-[11px] font-mono text-[var(--muted)]">{tg.key}</code>
                    {tg.description ? (
                      <p className="text-xs text-[var(--muted)] truncate max-w-[40ch]">
                        {tg.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <span className="flex-shrink-0 text-[11px] text-[var(--muted)] transition group-hover:text-[var(--blue)]">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
