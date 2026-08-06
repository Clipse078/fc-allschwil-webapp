import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getRoleDetailData,
  getPermissionEditorData,
  type RoleUser,
  type RoleOrgUnit,
} from "@/lib/roles/queries";
import RolePermissionEditor from "@/components/admin/roles/RolePermissionEditor";

type PageProps = {
  params: Promise<{ id: string }>;
};


function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default async function RoleDetailPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { id } = await params;
  const [role, editorData] = await Promise.all([
    getRoleDetailData(id),
    getPermissionEditorData(id),
  ]);

  if (!role) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Back link + header */}
      <div>
        <Link
          href="/dashboard/roles"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--text-2)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Alle Rollen
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--blue-light)]">
              <Shield className="h-6 w-6 text-[var(--blue)]" />
            </div>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--red)] font-[var(--font-display)]">
                Governance
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--blue)] font-[var(--font-display)]">
                {role.name}
              </h2>
              <p className="mt-1 font-mono text-[0.78rem] text-[var(--muted)]">
                {role.key}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusPill label="Plattform" tone="default" />
            {role.isSystem && <AdminStatusPill label="Geschützt" tone="warning" />}
            {role.users.length > 0 ? (
              <AdminStatusPill label="Aktiv" tone="success" />
            ) : (
              <AdminStatusPill label="Leer" tone="muted" />
            )}
            {role.canAccessVereinsleitung && (
              <AdminStatusPill label="Vereinsleitung" tone="default" />
            )}
            {role.canAttendVereinsleitungMeetings && (
              <AdminStatusPill label="Meetings" tone="default" />
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="sce-kpi-card p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Benutzer
          </p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
            {role.users.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Zugewiesene Benutzer
          </p>
        </div>
        <div className="sce-kpi-card p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Org-Einheiten
          </p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
            {role.orgUnits.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Verknüpfte Org-Einheiten
          </p>
        </div>
        <div className="sce-kpi-card p-5 col-span-2 lg:col-span-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Berechtigungen
          </p>
          <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
            {role.permissions.length}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-[var(--text-2)]">
            Zugewiesene Rechte
          </p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left: Users + Permissions */}
        <div className="space-y-6">

          {/* Description */}
          {role.description && (
            <div className="sce-detail-section">
              <div className="sce-detail-section-header">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Rolle
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Beschreibung
                </p>
              </div>
              <div className="sce-detail-section-body">
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {role.description}
                </p>
              </div>
            </div>
          )}

          {/* Users */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--muted)]" />
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                    Zuweisung
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Benutzer mit dieser Rolle
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
                {role.users.length}
              </span>
            </div>
            <div className="sce-detail-section-body">
              {role.users.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Users className="h-8 w-8 text-[var(--muted)]" />
                  <p className="text-sm font-medium text-[var(--text-2)]">
                    Keine Benutzer zugewiesen
                  </p>
                  <p className="text-[0.78rem] text-[var(--muted)]">
                    Diese Rolle ist noch keinem Benutzer zugeteilt.
                  </p>
                  <Link
                    href="/dashboard/users"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold text-[var(--blue)] transition-all hover:bg-[var(--blue-light)]"
                  >
                    Benutzer verwalten
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {role.users.map((user: RoleUser) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[0.72rem] font-bold text-[var(--text-2)]">
                          {user.firstName.charAt(0)}
                          {user.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-[0.75rem] text-[var(--muted)]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {user.isActive ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[var(--muted)]" />
                        )}
                        <Link
                          href={`/dashboard/users/${user.id}`}
                          className="text-[0.75rem] font-medium text-[var(--blue)] hover:underline"
                        >
                          Profil
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Permissions — editable matrix */}
          {editorData ? (
            <RolePermissionEditor
              roleId={role.id}
              roleName={role.name}
              moduleGroups={editorData.moduleGroups}
              initialAssignedKeys={editorData.assignedKeys}
            />
          ) : null}

        </div>

        {/* Right: Org Units + Meta */}
        <div className="space-y-6">

          {/* Org units */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--muted)]" />
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                    Organisation
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Verknüpfte Org-Einheiten
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
                {role.orgUnits.length}
              </span>
            </div>
            <div className="sce-detail-section-body">
              {role.orgUnits.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Building2 className="h-8 w-8 text-[var(--muted)]" />
                  <p className="text-sm font-medium text-[var(--text-2)]">
                    Keine Org-Einheiten
                  </p>
                  <p className="text-[0.78rem] text-[var(--muted)]">
                    Benutzer mit dieser Rolle sind keiner Org-Einheit zugeordnet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {role.orgUnits.map((unit: RoleOrgUnit) => (
                    <Link
                      key={unit.id}
                      href={`/dashboard/org-units/${unit.id}`}
                      className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] group-hover:bg-[var(--surface-3)]">
                          <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {unit.name}
                          </p>
                          <p className="truncate font-mono text-[0.68rem] text-[var(--muted)]">
                            {unit.key}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[0.68rem] font-medium text-[var(--muted)] group-hover:bg-[var(--border)]">
                        {unit.type}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role metadata */}
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                  Metadaten
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Rollen-Details
                </p>
              </div>
            </div>
            <div className="sce-detail-section-body space-y-4">
              <div className="sce-data-field">
                <span className="sce-data-label">Rollen-Key</span>
                <span className="font-mono text-sm font-medium text-[var(--foreground)]">
                  {role.key}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Vereinsleitung-Zugriff</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {role.canAccessVereinsleitung ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--muted)]" />
                  )}
                  <span className="text-sm text-[var(--text-2)]">
                    {role.canAccessVereinsleitung ? "Ja" : "Nein"}
                  </span>
                </div>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Meetings-Zugriff</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {role.canAttendVereinsleitungMeetings ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--muted)]" />
                  )}
                  <span className="text-sm text-[var(--text-2)]">
                    {role.canAttendVereinsleitungMeetings ? "Ja" : "Nein"}
                  </span>
                </div>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Erstellt am</span>
                <span className="text-sm text-[var(--foreground)]">
                  {formatDate(role.createdAt)}
                </span>
              </div>
              <div className="sce-data-field">
                <span className="sce-data-label">Zuletzt geändert</span>
                <span className="text-sm text-[var(--foreground)]">
                  {formatDate(role.updatedAt)}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
