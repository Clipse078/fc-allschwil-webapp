import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Users,
  Building2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getRolesWithCountsData, type RoleListItem } from "@/lib/roles/queries";

export default async function RolesPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const roles = await getRolesWithCountsData();

  const totalUsers = roles.reduce((sum: number, r: RoleListItem) => sum + r.userCount, 0);
  const totalPermissions = roles.reduce((sum: number, r: RoleListItem) => sum + r.permissionCount, 0);
  const rolesWithUsers = roles.filter((r: RoleListItem) => r.userCount > 0).length;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminSectionHeader
        eyebrow="Governance"
        title="Rollen"
        description="Alle Systemrollen im Überblick — Benutzer-Zuweisungen, Berechtigungen und Org-Einheiten auf einen Blick."
        actions={
          <Link
            href="/dashboard/permissions"
            className="fca-button-secondary flex items-center gap-2"
          >
            <KeyRound className="h-4 w-4" />
            Berechtigungen
          </Link>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Rollen gesamt"
          value={String(roles.length)}
          subtext="Definierte Systemrollen"
          trend="neutral"
          icon={<Shield style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Rollen mit Benutzern"
          value={String(rolesWithUsers)}
          subtext="Aktiv vergeben"
          trend="neutral"
          icon={<ShieldCheck style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Benutzerzuweisungen"
          value={String(totalUsers)}
          subtext="Rollenzuweisungen gesamt"
          trend="neutral"
          icon={<Users style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Berechtigungen"
          value={String(totalPermissions)}
          subtext="Rollenberechtigungen gesamt"
          trend="neutral"
          icon={<KeyRound style={{ width: 18, height: 18 }} />}
        />
      </div>

      {/* Roles Table */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="min-w-0 flex-1">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Systemrollen
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Alle Rollen
            </p>
          </div>
          <Link
            href="/dashboard/permissions"
            className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)] transition-opacity hover:opacity-70"
          >
            Berechtigungen
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {roles.length === 0 ? (
          <div className="sce-detail-section-body">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--surface-2)]">
                <Shield className="h-6 w-6 text-[var(--muted)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-2)]">
                  Keine Rollen vorhanden
                </p>
                <p className="mt-1 text-[0.78rem] text-[var(--muted)]">
                  Rollen werden über das System-Setup konfiguriert.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Rolle
                    </th>
                    <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Beschreibung
                    </th>
                    <th className="px-5 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Benutzer
                    </th>
                    <th className="px-5 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Org-Einheiten
                    </th>
                    <th className="px-5 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Berechtigungen
                    </th>
                    <th className="px-5 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {roles.map((role: RoleListItem) => (
                    <tr
                      key={role.id}
                      className="group transition-colors duration-100 hover:bg-[var(--surface-2)]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--blue-light)]">
                            <Shield className="h-4 w-4 text-[var(--blue)]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">
                              {role.name}
                            </p>
                            <p className="text-[0.72rem] font-mono text-[var(--muted)]">
                              {role.key}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-5 py-4">
                        {role.description ? (
                          <p className="truncate text-[0.82rem] text-[var(--text-2)]">
                            {role.description}
                          </p>
                        ) : (
                          <span className="text-[0.82rem] text-[var(--muted)]">
                            —
                          </span>
                        )}
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
                          <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">
                            {role.orgUnitCount}
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
                        <div className="flex flex-wrap gap-1.5">
                          {role.userCount > 0 ? (
                            <AdminStatusPill label="Aktiv" tone="success" />
                          ) : (
                            <AdminStatusPill label="Leer" tone="muted" />
                          )}
                          {role.canAccessVereinsleitung && (
                            <AdminStatusPill label="Vereinsleitung" tone="default" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/dashboard/roles/${role.id}`}
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

            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {roles.map((role: RoleListItem) => (
                <Link
                  key={role.id}
                  href={`/dashboard/roles/${role.id}`}
                  className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] transition-all duration-150 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--blue-light)]">
                        <Shield className="h-4.5 w-4.5 text-[var(--blue)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          {role.name}
                        </p>
                        <p className="text-[0.72rem] font-mono text-[var(--muted)]">
                          {role.key}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  </div>

                  {role.description && (
                    <p className="text-[0.82rem] text-[var(--text-2)] line-clamp-2">
                      {role.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[0.78rem] text-[var(--text-2)]">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <strong className="font-semibold text-[var(--foreground)]">
                        {role.userCount}
                      </strong>{" "}
                      Benutzer
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <strong className="font-semibold text-[var(--foreground)]">
                        {role.orgUnitCount}
                      </strong>{" "}
                      Org-Einheiten
                    </span>
                    <span className="flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <strong className="font-semibold text-[var(--foreground)]">
                        {role.permissionCount}
                      </strong>{" "}
                      Berechtigungen
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {role.userCount > 0 ? (
                      <AdminStatusPill label="Aktiv" tone="success" />
                    ) : (
                      <AdminStatusPill label="Leer" tone="muted" />
                    )}
                    {role.canAccessVereinsleitung && (
                      <AdminStatusPill label="Vereinsleitung" tone="default" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
