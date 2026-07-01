import Link from "next/link";
import { ArrowRight, KeyRound, Shield, Layers } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { EmptyState } from "@/components/ui/page";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPermissionsWithRoleMappingsData } from "@/lib/roles/queries";

const MODULE_LABELS: Record<string, string> = {
  USERS: "Benutzer",
  SEASONS: "Saisons",
  TEAMS: "Teams",
  PEOPLE: "Personen",
  EVENTS: "Events",
  FIXTURES: "Spiele",
  WOCHENPLAN: "Wochenplan",
  NEWS: "News",
  WEBSITE: "Website",
  INFOBOARD: "Infoboard",
  FUNCTIONS: "Funktionen",
  TARGETS: "Ziele",
  MEETINGS: "Meetings",
  INITIATIVES: "Initiativen",
  TEMPLATES: "Vorlagen",
  REGISTRATIONS: "Registrierungen",
};

function ModuleGroupCard({
  module,
  permissions,
}: {
  module: string;
  permissions: Array<{
    id: string;
    key: string;
    name: string;
    module: string;
    roles: { id: string; key: string; name: string }[];
  }>;
}) {
  const moduleLabel = MODULE_LABELS[module] ?? module;
  const totalRoleMappings = permissions.reduce(
    (sum, p) => sum + p.roles.length,
    0,
  );

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--blue-light)]">
            <Layers className="h-4 w-4 text-[var(--blue)]" />
          </div>
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Modul
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {moduleLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
            {permissions.length} {permissions.length === 1 ? "Recht" : "Rechte"}
          </span>
          {totalRoleMappings > 0 && (
            <span className="rounded-full bg-[var(--blue-light)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--blue)]">
              {totalRoleMappings} Zuweisungen
            </span>
          )}
        </div>
      </div>

      <div className="sce-detail-section-body">
        <div className="space-y-3">
          {permissions.map((perm) => (
            <div
              key={perm.id}
              className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {perm.name}
                </p>
                <p className="mt-0.5 font-mono text-[0.72rem] text-[var(--muted)]">
                  {perm.key}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {perm.roles.length === 0 ? (
                  <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[0.68rem] font-medium text-[var(--muted)]">
                    Keine Rolle
                  </span>
                ) : (
                  perm.roles.map((role) => (
                    <Link
                      key={role.id}
                      href={`/dashboard/roles/${role.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[0.68rem] font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-light)] hover:text-[var(--blue)]"
                    >
                      <Shield className="h-2.5 w-2.5" />
                      {role.name}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function PermissionsPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const data = await getPermissionsWithRoleMappingsData();

  const totalPermissions = data.permissions.length;
  const totalModules = data.moduleGroups.length;
  const mappedPermissions = data.permissions.filter(
    (p) => p.roles.length > 0,
  ).length;
  const unmappedPermissions = totalPermissions - mappedPermissions;

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminSectionHeader
        eyebrow="Governance"
        title="Berechtigungen"
        description="Alle Systemberechtigungen nach Modul gegliedert — Rollen-Zuweisungen und Zugriffsrechte auf einen Blick. Berechtigungen einer Rolle bearbeiten: Rolle öffnen → Berechtigungen bearbeiten."
        actions={
          <Link
            href="/dashboard/roles"
            className="fca-button-secondary flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            Rollen bearbeiten
          </Link>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Berechtigungen"
          value={String(totalPermissions)}
          subtext="Systemberechtigungen gesamt"
          trend="neutral"
          icon={<KeyRound style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Module"
          value={String(totalModules)}
          subtext="Berechtigungsgruppen"
          trend="neutral"
          icon={<Layers style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Zugewiesen"
          value={String(mappedPermissions)}
          subtext="Rechte mit Rollenbindung"
          trend="neutral"
          icon={<Shield style={{ width: 18, height: 18 }} />}
        />
        <KpiCard
          label="Ohne Rolle"
          value={String(unmappedPermissions)}
          subtext="Noch nicht zugewiesen"
          trend="neutral"
          icon={<KeyRound style={{ width: 18, height: 18 }} />}
        />
      </div>

      {/* Module groups or empty state */}
      {data.moduleGroups.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body">
            <EmptyState
              icon={<KeyRound className="h-10 w-10" />}
              heading="Keine Berechtigungen konfiguriert"
              description="Berechtigungen werden über das Seeding oder die Admin-Konfiguration erfasst."
              action={
                <Link
                  href="/dashboard/roles"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)] transition-all hover:opacity-70"
                >
                  Rollen anzeigen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {data.moduleGroups.map(({ module, permissions }) => (
            <ModuleGroupCard
              key={module}
              module={module}
              permissions={permissions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
