import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Key, Settings2 } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantDetail } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantForm from "@/components/admin/tenants/TenantForm";
import TenantConfigForm from "@/components/admin/tenants/TenantConfigForm";

type PageProps = { params: Promise<{ tenantSlug: string }> };

function TenantStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE: { label: "Aktiv", bg: "rgba(16,185,129,0.12)", color: "#10b981" },
    INACTIVE: { label: "Inaktiv", bg: "rgba(156,163,175,0.12)", color: "var(--muted)" },
    ARCHIVED: { label: "Archiviert", bg: "rgba(239,68,68,0.08)", color: "#ef4444" },
  };
  const cfg = map[status] ?? { label: status, bg: "var(--surface-3)", color: "var(--muted)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export default async function TenantDetailPage({ params }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.TENANTS_MANAGE);

  const { tenantSlug } = await params;
  const tenant = await getTenantDetail(tenantSlug);
  if (!tenant) notFound();

  const createdAt = new Date(tenant.createdAt).toLocaleDateString("de-CH", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const updatedAt = new Date(tenant.updatedAt).toLocaleDateString("de-CH", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const isEditable = canManage && tenant.status !== "ARCHIVED";

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Back link */}
      <Link
        href="/dashboard/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Alle Tenants
      </Link>

      <AdminSectionHeader
        eyebrow="Platform"
        title={tenant.name}
        description="Tenant-Details und Konfiguration."
        actions={<TenantStatusBadge status={tenant.status} />}
      />

      {/* Meta card */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Metadaten
          </p>
        </div>
        <div className="sce-detail-section-body">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Key className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Key</dt>
                <dd>
                  <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[0.8rem] text-[var(--text-2)]">
                    {tenant.key}
                  </code>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Erstellt</dt>
                <dd className="text-sm text-[var(--text-2)]">{createdAt}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Zuletzt geändert</dt>
                <dd className="text-sm text-[var(--text-2)]">{updatedAt}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Registrierungen</dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">
                  {tenant._count.registrations}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      {/* Core edit form */}
      {isEditable ? (
        <div>
          <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Bearbeiten
          </p>
          <TenantForm
            mode="edit"
            tenantKey={tenant.key}
            defaultValues={{ name: tenant.name, status: tenant.status }}
          />
        </div>
      ) : tenant.status === "ARCHIVED" ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
          Dieser Tenant ist archiviert und kann nicht mehr bearbeitet werden.
        </div>
      ) : null}

      {/* Config section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Konfiguration
          </p>
        </div>
        {isEditable ? (
          <TenantConfigForm
            tenantKey={tenant.key}
            defaultValues={{
              countryCode: tenant.countryCode,
              sportCategory: tenant.sportCategory,
              locale: tenant.locale,
              timezone: tenant.timezone,
              currency: tenant.currency,
              seasonStartMonth: tenant.seasonStartMonth,
              seasonTransitionDay: tenant.seasonTransitionDay,
              seasonTransitionMonth: tenant.seasonTransitionMonth,
            }}
          />
        ) : (
          <div className="sce-detail-section">
            <div className="sce-detail-section-body">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Land</dt>
                  <dd className="mt-0.5 font-mono text-sm">{tenant.countryCode}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Sportart</dt>
                  <dd className="mt-0.5 text-sm">{tenant.sportCategory}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Locale</dt>
                  <dd className="mt-0.5 font-mono text-sm">{tenant.locale}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Zeitzone</dt>
                  <dd className="mt-0.5 font-mono text-sm">{tenant.timezone}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Währung</dt>
                  <dd className="mt-0.5 font-mono text-sm">{tenant.currency}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Saisonbeginn</dt>
                  <dd className="mt-0.5 text-sm">Monat {tenant.seasonStartMonth}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Saisonübergang</dt>
                  <dd className="mt-0.5 text-sm">{tenant.seasonTransitionDay}. {tenant.seasonTransitionMonth}.</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
