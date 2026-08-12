import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { listClubEvents } from "@/lib/events/club-events-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import VeranstaltungCard from "@/components/admin/veranstaltungen/VeranstaltungCard";

type SearchParams = Promise<{
  updated?: string;
  submitted?: string;
}>;

type VeranstaltungenPageProps = {
  searchParams?: SearchParams;
};

export default async function VeranstaltungenPage({
  searchParams,
}: VeranstaltungenPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) {
    notFound();
  }

  const canManage = hasPermission(session, PERMISSIONS.EVENTS_MANAGE);
  const canDelete = hasPermission(session, PERMISSIONS.EVENTS_DELETE);
  const params = (await searchParams) ?? {};
  const showUpdated = params.updated === "1";
  const showSubmitted = params.submitted === "1";

  const events = await listClubEvents(tenantContext.id);

  const activeCount = events.filter((e) => e.status !== "ARCHIVED").length;
  const archivedCount = events.filter((e) => e.status === "ARCHIVED").length;

  // Sort: active first, archived after; within each group by startAt asc
  const sorted = [
    ...events.filter((e) => e.status !== "ARCHIVED"),
    ...events.filter((e) => e.status === "ARCHIVED"),
  ];

  return (
    <ToastProvider>
      <div className="max-w-[1200px] space-y-8">
        {/* Header */}
        <AdminSectionHeader
          eyebrow="Planung"
          title="Veranstaltungen"
          description="Tenant-verwaltete Vereinsanlässe wie Generalversammlung, Trainersitzung, Sponsorenanlass und weitere Vereinsevents."
          actions={
            canManage ? (
              <Link
                href="/dashboard/veranstaltungen/new"
                className="fca-button-primary"
              >
                <Plus className="h-4 w-4" />
                Veranstaltung erstellen
              </Link>
            ) : null
          }
        />

        {showUpdated ? (
          <div className="fca-status-box fca-status-box-success">
            Veranstaltung wurde erfolgreich gespeichert.
          </div>
        ) : null}

        {showSubmitted ? (
          <div className="fca-status-box fca-status-box-success">
            Veranstaltung wurde erfolgreich erstellt.
          </div>
        ) : null}

        {/* Hero */}
        <div className="sce-entity-hero">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/60">
                Veranstaltungen
              </p>
              <h3
                className="mt-1 text-2xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Vereinsanlässe
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
                Generalversammlung, Trainersitzung, Sponsorenanlass, Helfereinsatz
                und weitere Vereinsevents werden hier zentral verwaltet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:text-center">
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Aktiv
                </p>
                <p
                  className="mt-1 text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {activeCount}
                </p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Archiviert
                </p>
                <p
                  className="mt-1 text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {archivedCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sce-kpi-card">
            <p className="sce-data-label">Total</p>
            <p
              className="mt-1.5 text-2xl font-bold text-violet-600"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {events.length}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Veranstaltungen</p>
          </div>
          <div className="sce-kpi-card">
            <p className="sce-data-label">Aktiv</p>
            <p
              className="mt-1.5 text-2xl font-bold text-emerald-600"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Geplant / Live</p>
          </div>
          <div className="sce-kpi-card">
            <p className="sce-data-label">Archiviert</p>
            <p
              className="mt-1.5 text-2xl font-bold text-slate-500"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {archivedCount}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Abgeschlossen</p>
          </div>
          <div className="sce-kpi-card">
            <p className="sce-data-label">Typ</p>
            <p
              className="mt-1.5 text-sm font-semibold text-violet-600"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Vereinsanlass
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Manuell erfasst</p>
          </div>
        </div>

        {/* Events list */}
        <div className="space-y-4">
          <div className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Alle Veranstaltungen
                </span>
                <span className="sce-count-badge">{events.length}</span>
              </div>

              {canManage && (
                <Link
                  href="/dashboard/veranstaltungen/new"
                  className="fca-button-primary shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Erstellen
                </Link>
              )}
            </div>

            {events.length === 0 ? (
              <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
                  <CalendarDays className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <p className="font-semibold text-[var(--foreground)]">
                  Noch keine Veranstaltungen
                </p>
                <p className="max-w-sm text-sm text-[var(--muted)]">
                  Erstelle die erste Veranstaltung für deinen Verein — von der
                  Generalversammlung bis zum Sponsorenanlass.
                </p>
                {canManage && (
                  <Link
                    href="/dashboard/veranstaltungen/new"
                    className="fca-button-primary mt-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Veranstaltung erstellen
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          {sorted.map((event) => (
            <VeranstaltungCard
              key={event.id}
              event={event}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      </div>
    </ToastProvider>
  );
}
