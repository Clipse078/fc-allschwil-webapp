import Link from "next/link";
import { ArrowRight, KeyRound, Plus, Shield, Users } from "lucide-react";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import RoleScopeBadge from "@/components/admin/roles/RoleScopeBadge";
import ProtectedRoleBadge from "@/components/admin/roles/ProtectedRoleBadge";
import { EmptyState } from "@/components/ui/page";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default async function TenantRolesOverviewPage() {
  // Permission + tenant-context guard is already enforced by the parent
  // layout.tsx — re-resolving the tenant id here only to scope the query,
  // never to re-derive authorization.
  const tenantId = await requireActiveTenantId();
  const roles = await getTenantRolesOverview(tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link href="/dashboard/administration/roles/new" className="fca-button-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Neue Rolle
        </Link>
      </div>

      {roles.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body">
            <EmptyState
              icon={<Shield className="h-10 w-10" />}
              heading="Keine Rollen vorhanden"
              description="Erstelle die erste mandanten-eigene Rolle für diesen Verein."
            />
          </div>
        </div>
      ) : (
        <div className="sce-detail-section">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Rolle
                  </th>
                  <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Scope
                  </th>
                  <th className="px-5 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Benutzer
                  </th>
                  <th className="px-5 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Berechtigungen
                  </th>
                  <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Zuletzt geändert
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {roles.map((role) => (
                  <tr key={role.id} className="group transition-colors duration-100 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[var(--foreground)]">{role.name}</p>
                      {role.description ? (
                        <p className="mt-0.5 max-w-[280px] truncate text-[0.78rem] text-[var(--text-2)]">
                          {role.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <RoleScopeBadge scope="TENANT" />
                        {role.isSystem && <ProtectedRoleBadge />}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[var(--muted)]" />
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">
                          {role.userCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">
                          {role.permissionCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {role.isArchived ? (
                        <AdminStatusPill label="Archiviert" tone="muted" />
                      ) : (
                        <AdminStatusPill label="Aktiv" tone="success" />
                      )}
                    </td>
                    <td className="px-5 py-4 text-[0.78rem] text-[var(--text-2)]">
                      {formatDate(role.updatedAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/administration/roles/${role.id}`}
                        className="inline-flex items-center gap-1 text-[0.78rem] font-medium text-[var(--blue)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      >
                        Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/dashboard/administration/roles/${role.id}`}
                className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{role.name}</p>
                    {role.description ? (
                      <p className="mt-0.5 text-[0.82rem] text-[var(--text-2)] line-clamp-2">
                        {role.description}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)]" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <RoleScopeBadge scope="TENANT" />
                  {role.isSystem && <ProtectedRoleBadge />}
                  {role.isArchived ? (
                    <AdminStatusPill label="Archiviert" tone="muted" />
                  ) : (
                    <AdminStatusPill label="Aktiv" tone="success" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-[var(--text-2)]">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <strong className="font-semibold text-[var(--foreground)]">{role.userCount}</strong> Benutzer
                  </span>
                  <span className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <strong className="font-semibold text-[var(--foreground)]">{role.permissionCount}</strong> Rechte
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
