import Link from "next/link";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  PauseCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPlatformOpsOverview } from "@/lib/tenants/platform-ops/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantStatusBadge from "@/components/admin/tenants/TenantStatusBadge";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";
import { DashboardActivityFeed } from "@/components/ui/dashboard/DashboardActivityFeed";

function formatRelativeTime(value: Date): string {
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tg.`;
}

export default async function SuperadminCommandCenterPage() {
  await connection();

  const session = await requireAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.TENANTS_MANAGE);

  let overview: Awaited<ReturnType<typeof getPlatformOpsOverview>> | null = null;
  try {
    overview = await getPlatformOpsOverview();
  } catch {
    overview = null;
  }

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/60">
              Platform Operations
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Superadmin Command Center
            </h1>
            <p className="max-w-2xl text-sm text-white/70">
              Operative Übersicht über Tenant-Lifecycle, Aufmerksamkeitssignale und
              jüngste Plattformaktivität.
            </p>
          </div>
          {canManage && (
            <Link href="/dashboard/admin/tenants/new" className="fca-button-primary shrink-0">
              <Plus className="h-4 w-4" />
              Neuer Tenant
            </Link>
          )}
        </div>
      </div>

      <AdminSectionHeader
        eyebrow="Übersicht"
        title="Tenant-Betrieb"
        description="Lifecycle-Kennzahlen ohne Billing- oder Health-Metriken."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        <DashboardKpiCard
          title="Tenants gesamt"
          value={String(overview?.totals.all ?? "—")}
          accent="default"
          icon={<Building2 className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Aktiv"
          value={String(overview?.totals.active ?? "—")}
          accent="success"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Onboarding"
          value={String(overview?.totals.onboarding ?? "—")}
          accent="info"
          icon={<Users className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Suspendiert"
          value={String(overview?.totals.suspended ?? "—")}
          accent="warning"
          icon={<PauseCircle className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Archiviert"
          value={String(overview?.totals.archived ?? "—")}
          accent="danger"
          icon={<Building2 className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Aufmerksamkeit"
          value={String(overview?.totals.needsAttention ?? "—")}
          accent="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Aufmerksamkeit
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Tenants mit Handlungsbedarf
              </p>
            </div>
            <Link
              href="/dashboard/admin/tenants?filter=attention"
              className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)]"
            >
              Registry
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="sce-detail-section-body space-y-3">
            {!overview || overview.attentionTenants.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Keine abgeleiteten Aufmerksamkeitssignale.
              </p>
            ) : (
              overview.attentionTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/dashboard/admin/tenants/${tenant.key}`}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] px-4 py-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">{tenant.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {tenant.attentionItems.map((item) => item.label).join(" · ")}
                    </p>
                  </div>
                  <TenantStatusBadge operationalPhase={tenant.operationalPhase} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Aktivität
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Jüngste Plattformereignisse
              </p>
            </div>
            <Link
              href="/dashboard/logs"
              className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--blue)]"
            >
              Audit
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="sce-detail-section-body">
            <DashboardActivityFeed
              items={(overview?.recentActivity ?? []).map((item) => ({
                key: item.id,
                icon: <Building2 className="h-4 w-4" />,
                title: item.summary,
                subtitle: item.actorName ?? item.actorEmail ?? "System",
                timestamp: formatRelativeTime(item.createdAt),
                tag: item.tenantKey ?? undefined,
              }))}
              emptyState={
                <p className="text-sm text-[var(--muted)]">
                  Noch keine relevanten Audit-Ereignisse verfügbar.
                </p>
              }
            />
          </div>
        </div>
      </div>

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Schnellzugriff
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Platform-Verwaltung
            </p>
          </div>
        </div>
        <div className="sce-detail-section-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/dashboard/admin/tenants" className="fca-button-secondary justify-center">
            Tenant Registry
          </Link>
          <Link href="/dashboard/users" className="fca-button-secondary justify-center">
            Platform Users
          </Link>
          <Link href="/dashboard/roles" className="fca-button-secondary justify-center">
            Rollen
          </Link>
          <Link href="/dashboard/logs" className="fca-button-secondary justify-center">
            Audit Logs
          </Link>
        </div>
      </div>
    </div>
  );
}
