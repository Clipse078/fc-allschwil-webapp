import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Globe,
  Key,
  Plug,
  Settings2,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantDetail } from "@/lib/tenants/queries";
import { getCurrentTenantContext } from "@/lib/tenants/context";
import { formatCurrency, formatDate, getCurrentSeasonLabel } from "@/lib/tenant-runtime/formatters";
import {
  getLatestSuspensionReason,
  getTenantAdministrators,
  getTenantLifecycleAudit,
  getTenantRegistryItemByKey,
} from "@/lib/tenants/platform-ops/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantForm from "@/components/admin/tenants/TenantForm";
import TenantConfigForm from "@/components/admin/tenants/TenantConfigForm";
import BrandingPreviewCard from "@/components/admin/branding/BrandingPreviewCard";
import TenantDeleteButton from "@/components/admin/tenants/TenantDeleteButton";
import TenantLifecycleActions from "@/components/admin/tenants/TenantLifecycleActions";
import TenantStatusBadge from "@/components/admin/tenants/TenantStatusBadge";

type PageProps = { params: Promise<{ tenantSlug: string }> };

export default async function TenantDetailPage({ params }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.TENANTS_MANAGE);
  const canDelete = hasPermission(session, PERMISSIONS.TENANTS_DELETE);

  const { tenantSlug } = await params;
  const [tenant, registryItem, ctx, administrators, lifecycleAudit, suspensionReason] =
    await Promise.all([
      getTenantDetail(tenantSlug),
      getTenantRegistryItemByKey(tenantSlug),
      getCurrentTenantContext(tenantSlug),
      getTenantRegistryItemByKey(tenantSlug).then((item) =>
        item ? getTenantAdministrators(item.id, item.key) : [],
      ),
      getTenantRegistryItemByKey(tenantSlug).then((item) =>
        item ? getTenantLifecycleAudit(item.id) : [],
      ),
      getTenantRegistryItemByKey(tenantSlug).then((item) =>
        item ? getLatestSuspensionReason(item.id) : null,
      ),
    ]);
  if (!tenant || !registryItem) notFound();

  const formatCtx = ctx ?? { locale: null, timezone: null };
  const createdAt = formatDate(tenant.createdAt, formatCtx);
  const updatedAt = formatDate(tenant.updatedAt, formatCtx);
  const isEditable = canManage && tenant.status !== "ARCHIVED";
  const previewCurrency = ctx ? formatCurrency(1234.5, ctx) : null;
  const previewDate = ctx ? formatDate(new Date(), ctx) : null;
  const previewSeason = ctx ? getCurrentSeasonLabel(ctx) : null;

  return (
    <div className="space-y-8 max-w-4xl">
      <Link
        href="/dashboard/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tenant Registry
      </Link>

      <AdminSectionHeader
        eyebrow="Platform"
        title={tenant.name}
        description="Operativer Tenant-Kontext, Lifecycle-Steuerung und Audit-Überblick."
        actions={
          <TenantStatusBadge
            status={tenant.status}
            operationalPhase={registryItem.operationalPhase}
            size="md"
          />
        }
      />

      {registryItem.needsAttention && (
        <div className="rounded-[var(--radius-xl)] border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--sce-warning)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Aufmerksamkeit erforderlich</p>
              <ul className="mt-1 space-y-0.5 text-sm text-[var(--text-2)]">
                {registryItem.attentionItems.map((item) => (
                  <li key={item.code}>{item.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Übersicht
            </p>
          </div>
          <div className="sce-detail-section-body">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Key className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Tenant ID
                  </dt>
                  <dd className="font-mono text-xs text-[var(--text-2)]">{tenant.id}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Slug
                  </dt>
                  <dd>
                    <code className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[0.8rem] text-[var(--text-2)]">
                      {tenant.key}
                    </code>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Domain
                  </dt>
                  <dd className="text-sm text-[var(--text-2)]">{tenant.key}.sportclubevo.app</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Erstellt
                  </dt>
                  <dd className="text-sm text-[var(--text-2)]">{createdAt}</dd>
                </div>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Locale / Land
                </dt>
                <dd className="mt-0.5 text-sm text-[var(--text-2)]">
                  {tenant.locale ?? "—"} · {tenant.countryCode ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Zeitzone
                </dt>
                <dd className="mt-0.5 text-sm text-[var(--text-2)]">{tenant.timezone ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--muted)]" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Zugang & Administration
              </p>
            </div>
          </div>
          <div className="sce-detail-section-body space-y-3">
            <p className="text-sm text-[var(--text-2)]">
              {registryItem.activeClubAdminCount} aktive Club-Admins ·{" "}
              {registryItem.activeMemberCount} aktive Mitgliedschaften
            </p>
            {administrators.length === 0 ? (
              <p className="text-sm font-medium text-[var(--sce-warning)]">
                Kein aktiver Club-Administrator zugewiesen.
              </p>
            ) : (
              <ul className="space-y-2">
                {administrators.map((admin) => (
                  <li
                    key={admin.id}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">{admin.name}</p>
                      <p className="text-xs text-[var(--muted)]">{admin.email}</p>
                    </div>
                    <Link
                      href={`/dashboard/users/${admin.id}`}
                      className="text-xs font-medium text-[var(--blue)]"
                    >
                      Profil
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Operations
            </p>
          </div>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Lifecycle-Status
              </p>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {registryItem.operationalPhase} ({tenant.status})
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Zuletzt geändert
              </p>
              <p className="mt-1 text-sm text-[var(--text-2)]">{updatedAt}</p>
            </div>
          </div>
          {suspensionReason && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Letzter Sperr-/Archivgrund
              </p>
              <p className="mt-1 text-sm text-[var(--text-2)]">{suspensionReason}</p>
            </div>
          )}
          <TenantLifecycleActions
            tenantKey={tenant.key}
            tenantName={tenant.name}
            status={tenant.status}
            canManage={canManage}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-[var(--muted)]" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Integrationen
              </p>
            </div>
          </div>
          <div className="sce-detail-section-body space-y-2 text-sm text-[var(--text-2)]">
            <p>Website: {registryItem.websiteEnabled ? "aktiviert" : "deaktiviert"}</p>
            <p>SFV: über Tenant-Integrationskonfiguration verwaltet</p>
          </div>
        </div>

        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[var(--muted)]" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Billing
              </p>
            </div>
          </div>
          <div className="sce-detail-section-body">
            <p className="text-sm text-[var(--muted)]">
              Billing-Integration wird in einem späteren Slice über Stripe verwaltet.
            </p>
          </div>
        </div>
      </div>

      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Audit
          </p>
        </div>
        <div className="sce-detail-section-body">
          {lifecycleAudit.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Noch keine Tenant-Lifecycle-Ereignisse.</p>
          ) : (
            <ul className="space-y-2">
              {lifecycleAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{entry.action}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {(entry.actorUser
                        ? `${entry.actorUser.firstName ?? ""} ${entry.actorUser.lastName ?? ""}`.trim()
                        : null) || entry.actorUser?.email || "System"}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {formatDate(entry.createdAt, formatCtx)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ctx && (
        <div className="sce-detail-section">
          <div className="sce-detail-section-header">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[var(--muted)]" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Laufzeit-Kontext
              </p>
            </div>
          </div>
          <div className="sce-detail-section-body">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Währung
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-[var(--foreground)]">{previewCurrency}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Datum (heute)
                </dt>
                <dd className="mt-0.5 text-sm text-[var(--foreground)]">{previewDate}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Aktive Saison
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-[var(--foreground)]">{previewSeason}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <BrandingPreviewCard
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl}
        primaryColor={tenant.primaryColor}
        secondaryColor={tenant.secondaryColor}
      />

      {isEditable ? (
        <div>
          <p className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Stammdaten
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
              logoUrl: tenant.logoUrl,
              primaryColor: tenant.primaryColor,
              secondaryColor: tenant.secondaryColor,
            }}
          />
        ) : (
          <div className="sce-detail-section">
            <div className="sce-detail-section-body">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Land
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm">
                    {tenant.countryCode ?? (
                      <span className="italic text-[var(--muted)]">Nicht konfiguriert</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Locale
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm">
                    {tenant.locale ?? (
                      <span className="italic text-[var(--muted)]">Nicht konfiguriert</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {canDelete ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-red-700">
            Gefahrenzone — SCE Super Admin
          </p>
          <p className="mb-3 text-sm text-red-700">
            Löscht den Tenant und alle zugehörigen Daten dauerhaft. Globale Benutzerkonten bleiben erhalten.
          </p>
          <TenantDeleteButton tenantSlug={tenant.key} tenantName={tenant.name} />
        </div>
      ) : null}
    </div>
  );
}
