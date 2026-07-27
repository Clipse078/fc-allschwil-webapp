import Link from "next/link";
import {
  Archive,
  Dumbbell,
  Layers,
  Plus,
} from "lucide-react";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { findAllTrainingSeries } from "@/lib/training/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
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

const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function sortWeekdays(days: Weekday[]): Weekday[] {
  return [...days].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
}

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

type TrainingSearchParams = { archived?: string };

type Props = {
  searchParams?: Promise<TrainingSearchParams>;
};

export default async function TrainingPlannerPage({ searchParams }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  const params: TrainingSearchParams = searchParams
    ? await searchParams
    : {};
  const showArchived = params.archived === "1";

  const allSeries = await findAllTrainingSeries(tenantId, {
    includeArchived: true,
  });

  const activeSeries = allSeries.filter((s) => s.status !== "ARCHIVED");
  const archivedSeries = allSeries.filter((s) => s.status === "ARCHIVED");
  const displayedSeries = showArchived ? allSeries : activeSeries;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="Trainingsplaner"
        description="Übersicht aller Trainingsserien. Klicke auf Ressourcen zuweisen, um Anlagen-Ressourcen zu verwalten."
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              {archivedSeries.length > 0 && (
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
              )}
            </div>
          ) : null
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
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSeries.map((series) => {
            const sortedDays = sortWeekdays(
              series.recurrenceDays.map((d) => d.weekday as Weekday),
            );
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

                  {canManage && (
                    <Link
                      href={`/dashboard/training/series/${series.id}/allocations`}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
                    >
                      <Layers className="h-3.5 w-3.5 text-[var(--blue)]" />
                      Ressourcen zuweisen
                    </Link>
                  )}
                </div>

                <div className="sce-detail-section-body">
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                    <div className="sce-data-field">
                      <p className="sce-data-label">Zeit</p>
                      <p className="sce-data-value mt-1.5">
                        {series.startsAt} – {series.endsAt}
                      </p>
                    </div>

                    <div className="sce-data-field">
                      <p className="sce-data-label">Wochentage</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {sortedDays.length > 0 ? (
                          sortedDays.map((day) => (
                            <span
                              key={day}
                              className="inline-flex items-center rounded-full border border-[var(--blue)]/30 bg-[var(--blue-light)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--blue)]"
                            >
                              {WEEKDAY_LABELS[day]}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-[var(--muted)]">—</span>
                        )}
                      </div>
                    </div>

                    <div className="sce-data-field">
                      <p className="sce-data-label">Zeitzone</p>
                      <p className="sce-data-value mt-1.5">{series.timezone}</p>
                    </div>

                    {series.description ? (
                      <div className="sce-data-field col-span-2 sm:col-span-1">
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
