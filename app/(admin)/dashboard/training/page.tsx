import Link from "next/link";
import {
  Archive,
  CalendarDays,
  Dumbbell,
  Layers,
  Pencil,
  Plus,
} from "lucide-react";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listTrainingSeries } from "@/lib/training/training-service";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesArchiveButton from "@/components/admin/training/TrainingSeriesArchiveButton";
import type { TrainingSeriesStatus, Weekday } from "@/lib/training/types";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Mo",
  TUESDAY: "Di",
  WEDNESDAY: "Mi",
  THURSDAY: "Do",
  FRIDAY: "Fr",
  SATURDAY: "Sa",
  SUNDAY: "So",
};

function statusBadgeClasses(status: TrainingSeriesStatus): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "INACTIVE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ARCHIVED":
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
}

function statusLabel(status: TrainingSeriesStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "INACTIVE":
      return "Inaktiv";
    case "ARCHIVED":
      return "Archiviert";
  }
}

/** Formats an ISO datetime as "DD.MM.YYYY" for display. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type TrainingSearchParams = { archived?: string };

type Props = {
  searchParams?: Promise<TrainingSearchParams>;
};

export default async function TrainingCenterPage({ searchParams }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  const params: TrainingSearchParams = searchParams
    ? await searchParams
    : {};
  const showArchived = params.archived === "1";

  const allSeries = await listTrainingSeries(tenantId, { includeArchived: true });

  const activeSeries = allSeries.filter((s) => s.status !== "ARCHIVED");
  const archivedSeries = allSeries.filter((s) => s.status === "ARCHIVED");
  const displayedSeries = showArchived ? allSeries : activeSeries;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="TrainingCenter"
        description="Übersicht aller Trainingsserien. Beim Speichern werden die konkreten Trainingstermine automatisch generiert."
        actions={
          <>
            {archivedSeries.length > 0 ? (
              <Link
                href={
                  showArchived
                    ? "/dashboard/training"
                    : "/dashboard/training?archived=1"
                }
                className="fca-button-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? "Archiv ausblenden" : "Archiv anzeigen"}
              </Link>
            ) : null}
            {canManage ? (
              <Link
                href="/dashboard/training/new"
                className="fca-button-primary inline-flex items-center gap-1.5 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Neue Trainingsserie
              </Link>
            ) : null}
          </>
        }
      />

      {displayedSeries.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Dumbbell className="h-10 w-10 text-[var(--muted)]" />
            <p className="font-semibold text-[var(--foreground)]">
              {showArchived
                ? "Keine Trainingsserien vorhanden"
                : "Keine aktiven Trainingsserien"}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {showArchived
                ? "Es wurden noch keine Trainingsserien erstellt."
                : "Alle Trainingsserien sind archiviert oder es wurden noch keine erstellt."}
            </p>
            {canManage ? (
              <Link
                href="/dashboard/training/new"
                className="fca-button-primary mt-2 inline-flex items-center gap-1.5 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Neue Trainingsserie
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSeries.map((series) => {
            const validFrom = formatDate(series.validFrom);
            const validUntil = formatDate(series.validUntil);
            return (
              <div key={series.id} className="sce-detail-section">
                <div className="sce-detail-section-header">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
                      <Dumbbell className="h-4 w-4 text-[var(--blue)]" />
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {series.title}
                      </span>
                      <span
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${statusBadgeClasses(series.status as TrainingSeriesStatus)}`}
                      >
                        {statusLabel(series.status as TrainingSeriesStatus)}
                      </span>
                    </div>
                  </div>

                  {canManage && series.status !== "ARCHIVED" && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/training/series/${series.id}/allocations`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
                      >
                        <Layers className="h-3.5 w-3.5 text-[var(--blue)]" />
                        Ressourcen
                      </Link>
                      <Link
                        href={`/dashboard/training/series/${series.id}/edit`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[var(--blue)]" />
                        Bearbeiten
                      </Link>
                      <TrainingSeriesArchiveButton seriesId={series.id} seriesTitle={series.title} />
                    </div>
                  )}
                </div>

                <div className="sce-detail-section-body">
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                    <div className="sce-data-field col-span-2">
                      <p className="sce-data-label">Wochentage &amp; Zeiten</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {series.weekdaySchedules.length > 0 ? (
                          series.weekdaySchedules.map((s) => (
                            <span
                              key={s.weekday}
                              className="inline-flex items-center rounded-full border border-[var(--blue)]/30 bg-[var(--blue-light)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--blue)]"
                            >
                              {WEEKDAY_LABELS[s.weekday]} {s.startsAt}–{s.endsAt}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--muted)]">—</span>
                        )}
                      </div>
                    </div>

                    <div className="sce-data-field">
                      <p className="sce-data-label">Zeitraum</p>
                      <p className="sce-data-value mt-1.5">
                        {validFrom && validUntil ? `${validFrom} – ${validUntil}` : "Unbegrenzt"}
                      </p>
                    </div>

                    <div className="sce-data-field">
                      <p className="sce-data-label">Zeitzone</p>
                      <p className="sce-data-value mt-1.5">{series.timezone}</p>
                    </div>

                    <div className="sce-data-field">
                      <p className="sce-data-label">Generierte Termine</p>
                      <p className="sce-data-value mt-1.5 flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-[var(--muted)]" />
                        {series.sessionCount}
                      </p>
                    </div>

                    {series.description ? (
                      <div className="sce-data-field col-span-2 sm:col-span-4">
                        <p className="sce-data-label">Beschreibung</p>
                        <p className="sce-data-value mt-1.5 line-clamp-2">
                          {series.description}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {!canManage && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <Link
                        href={`/dashboard/training/series/${series.id}/allocations`}
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--blue)] hover:underline"
                      >
                        <Layers className="h-3 w-3" />
                        Ressourcenzuteilung ansehen
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showArchived && archivedSeries.length > 0 && (
        <p className="text-xs text-[var(--muted)] text-center">
          {archivedSeries.length} archivierte{" "}
          {archivedSeries.length === 1 ? "Trainingsserie" : "Trainingsserien"} —{" "}
          <Link
            href="/dashboard/training?archived=1"
            className="text-[var(--blue)] hover:underline"
          >
            Archiv anzeigen
          </Link>
        </p>
      )}
    </div>
  );
}
