import {
  CalendarDays,
  CheckCircle2,
  Flag,
  Layers3,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createNextSeasonAction,
  deletePlannedSeasonAction,
} from "@/app/(admin)/dashboard/seasons/actions";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getSeasonsOverviewData } from "@/lib/seasons/queries";
import {
  getSeasonLifecycleStatusClasses,
  type SeasonLifecycleStatus,
} from "@/lib/seasons/status";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

type SeasonSummary = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  lifecycleStatus: SeasonLifecycleStatus;
  lifecycleStatusLabel: string;
  shouldBeActive: boolean;
  teamSeasonCount: number;
  eventCount: number;
};

function formatSwissDate(value: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

type SeasonsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

type FeedbackBanner = {
  boxClass: string;
  text: string;
};

function getFeedbackBanner(status?: string): FeedbackBanner | null {
  switch (status) {
    case "create-success":
      return {
        boxClass: "fca-status-box-success",
        text: "Die nächste Saison wurde erfolgreich erstellt und ist nun In Planung.",
      };
    case "create-exists":
      return {
        boxClass: "fca-status-box-warn",
        text: "Die nächste Saison existiert bereits und bleibt In Planung.",
      };
    case "create-invalid":
      return {
        boxClass: "fca-status-box-error",
        text: "Die nächste Saison konnte nicht berechnet werden.",
      };
    case "delete-success":
      return {
        boxClass: "fca-status-box-success",
        text: "Die geplante Saison wurde erfolgreich gelöscht.",
      };
    case "delete-not-allowed":
      return {
        boxClass: "fca-status-box-error",
        text: "Nur Saisons mit dem Status In Planung dürfen gelöscht werden.",
      };
    case "delete-has-dependencies":
      return {
        boxClass: "fca-status-box-error",
        text: "Diese Saison kann nicht gelöscht werden, da bereits Teams, Events oder Importläufe damit verknüpft sind.",
      };
    case "delete-not-found":
      return {
        boxClass: "fca-status-box-error",
        text: "Die gewählte Saison wurde nicht gefunden.",
      };
    case "delete-missing-id":
      return {
        boxClass: "fca-status-box-error",
        text: "Es wurde keine Saison-ID zur Löschung übergeben.",
      };
    case "forbidden":
      return {
        boxClass: "fca-status-box-error",
        text: "Du hast keine Berechtigung, um Saisons zu verwalten.",
      };
    default:
      return null;
  }
}

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.SEASONS_MANAGE);

  const params = (await searchParams) ?? {};
  const seasons = (await getSeasonsOverviewData()) as SeasonSummary[];
  const feedback = getFeedbackBanner(params.status);

  const ongoingCount = seasons.filter(
    (s) => s.lifecycleStatus === "ONGOING",
  ).length;
  const planningCount = seasons.filter(
    (s) => s.lifecycleStatus === "PLANNING",
  ).length;
  const completedCount = seasons.filter(
    (s) => s.lifecycleStatus === "COMPLETED",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminSectionHeader
        eyebrow="Saisons"
        title="Saisonverwaltung"
        description="Lifecycle-geführte Saisons als führende Entität für Teams und Events. Neue Saisons werden automatisch In Planung gesetzt und beim Start laufend."
        actions={
          canManage ? (
            <form action={createNextSeasonAction}>
              <button type="submit" className="fca-button-primary">
                <Plus className="h-4 w-4" />
                Neue Saison planen
              </button>
            </form>
          ) : null
        }
      />

      {/* Feedback */}
      {feedback ? (
        <div className={`fca-status-box ${feedback.boxClass}`}>
          {feedback.text}
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Saisons</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {seasons.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Laufend</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {ongoingCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">aktive Saison</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">In Planung</p>
          <p
            className="mt-1.5 text-2xl font-bold text-amber-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {planningCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">zukünftige Saison</p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Abgeschlossen</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {completedCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">vergangene Saisons</p>
        </div>
      </div>

      {/* Empty state */}
      {seasons.length === 0 ? (
        <div className="sce-detail-section">
          <div className="sce-detail-section-body flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CalendarDays className="h-10 w-10 text-[var(--muted)]" />
            <p className="font-semibold text-[var(--foreground)]">
              Noch keine Saisons
            </p>
            <p className="text-sm text-[var(--muted)]">
              Erstelle die erste Saison über den Button oben rechts.
            </p>
          </div>
        </div>
      ) : null}

      {/* Season cards */}
      {seasons.map((season) => {
        const canDelete =
          season.lifecycleStatus === "PLANNING" &&
          season.teamSeasonCount === 0 &&
          season.eventCount === 0;

        const isOngoing = season.lifecycleStatus === "ONGOING";

        if (isOngoing) {
          return (
            <div key={season.id} className="sce-entity-hero">
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Laufende Saison
                  </p>
                  <h3
                    className="mt-1 text-2xl font-bold text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {season.name}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-full border border-white/20 bg-white/15 px-3 text-[0.7rem] font-semibold text-white">
                    {season.lifecycleStatusLabel}
                  </span>
                  {season.shouldBeActive ? (
                    <span className="inline-flex h-6 items-center rounded-full border border-white/20 bg-white/10 px-3 text-[0.7rem] font-semibold text-white/80">
                      Führende Saison
                    </span>
                  ) : null}
                  {season.isActive !== season.shouldBeActive ? (
                    <span className="inline-flex h-6 items-center rounded-full border border-rose-300/60 bg-rose-500/20 px-3 text-[0.7rem] font-semibold text-rose-200">
                      DB-Status prüfen
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="relative z-10 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                    Zeitraum
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-white">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-white/55" />
                    {formatSwissDate(season.startDate)} –{" "}
                    {formatSwissDate(season.endDate)}
                  </p>
                </div>

                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                    Teams
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Layers3 className="h-3.5 w-3.5 shrink-0 text-white/55" />
                    <span className="text-sm font-semibold text-white">
                      {season.teamSeasonCount}
                    </span>
                    <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.68rem] font-bold text-white">
                      {season.teamSeasonCount}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                    Events
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Flag className="h-3.5 w-3.5 shrink-0 text-white/55" />
                    <span className="text-sm font-semibold text-white">
                      {season.eventCount}
                    </span>
                    <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[0.68rem] font-bold text-white">
                      {season.eventCount}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                    DB-Flag aktiv
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-white">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white/55" />
                    {season.isActive ? "Ja" : "Nein"}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={season.id} className="sce-detail-section">
            {/* Section header */}
            <div className="sce-detail-section-header">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
                  <CalendarDays className="h-4 w-4 text-[var(--blue)]" />
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {season.name}
                  </span>
                  <span
                    className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${getSeasonLifecycleStatusClasses(season.lifecycleStatus)}`}
                  >
                    {season.lifecycleStatusLabel}
                  </span>
                  {season.isActive !== season.shouldBeActive ? (
                    <span className="inline-flex h-5 items-center rounded-full border border-rose-200 bg-rose-50 px-2 text-[0.65rem] font-semibold text-rose-700">
                      DB-Status prüfen
                    </span>
                  ) : null}
                </div>
              </div>

              {canDelete ? (
                <form action={deletePlannedSeasonAction}>
                  <input type="hidden" name="seasonId" value={season.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Löschen
                  </button>
                </form>
              ) : null}
            </div>

            {/* Section body */}
            <div className="sce-detail-section-body">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <div className="sce-data-field">
                  <p className="sce-data-label">Zeitraum</p>
                  <p className="sce-data-value mt-1.5 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                    {formatSwissDate(season.startDate)} –{" "}
                    {formatSwissDate(season.endDate)}
                  </p>
                </div>

                <div className="sce-data-field">
                  <p className="sce-data-label">Teams</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Layers3 className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                    <span className="sce-data-value">
                      {season.teamSeasonCount}
                    </span>
                    <span className="sce-count-badge">
                      {season.teamSeasonCount}
                    </span>
                  </div>
                </div>

                <div className="sce-data-field">
                  <p className="sce-data-label">Events</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Flag className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                    <span className="sce-data-value">{season.eventCount}</span>
                    <span className="sce-count-badge">{season.eventCount}</span>
                  </div>
                </div>

                <div className="sce-data-field">
                  <p className="sce-data-label">DB-Flag aktiv</p>
                  <p className="sce-data-value mt-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--blue)]" />
                    {season.isActive ? "Ja" : "Nein"}
                  </p>
                </div>
              </div>

              {season.lifecycleStatus === "PLANNING" && !canDelete ? (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Löschen nicht möglich: Saison hat bereits verknüpfte Teams
                  oder Events.
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
