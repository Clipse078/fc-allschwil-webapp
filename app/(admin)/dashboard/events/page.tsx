import Link from "next/link";
import {
  CalendarDays,
  Dumbbell,
  Plus,
  Trophy,
  Upload,
  Volleyball,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAvailableTeamSeasons } from "@/lib/teams/queries";
import { getEventsListData } from "@/lib/events/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import SeasonContextSelector from "@/components/admin/shared/SeasonContextSelector";

type SeasonOption = {
  key: string;
  name: string;
  isActive: boolean;
};

type EventItem = {
  type: string;
  season: { key: string };
};

type EventsPageProps = {
  searchParams?: Promise<{
    season?: string;
    submitted?: string;
    count?: string;
  }>;
};

function getSubmittedMessage(submitted?: string, count?: string) {
  if (submitted !== "1") {
    return null;
  }

  const parsedCount = Number(count ?? "1");
  const safeCount =
    Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;

  if (safeCount === 1) {
    return "Event wurde zur Prüfung eingereicht.";
  }

  return String(safeCount) + " Trainings wurden zur Prüfung eingereicht.";
}

const EVENT_TYPES = [
  {
    key: "MATCH",
    label: "Matches",
    description:
      "Ligaspiele, Freundschaftsspiele und weitere Matchformate pro Team. Speist Homepage, Spielplan, Wochenplan, Teamseiten und Infoboard.",
    icon: Volleyball,
    iconColor: "text-blue-600",
    iconBg: "border-blue-200 bg-blue-50",
    sources: ["ClubCorner / fvnws", "Manuell", "CSV / Excel"],
    createHref: "/dashboard/events/matches/new",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    key: "TOURNAMENT",
    label: "Turniere",
    description:
      "Turnierdaten pro Team — PlayMore, Hallenturniere und interne Turniere. Wird auf Website, Wochenplan und Infoboard ausgespielt.",
    icon: Trophy,
    iconColor: "text-amber-600",
    iconBg: "border-amber-200 bg-amber-50",
    sources: ["ClubCorner / fvnws", "Manuell", "CSV / Excel"],
    createHref: "/dashboard/events/tournaments/new",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    key: "TRAINING",
    label: "Trainings",
    description:
      "Trainingssessions werden zentral verwaltet und speisen Trainingsplan, Wochenplan, Teamseiten und Infoboard.",
    icon: Dumbbell,
    iconColor: "text-emerald-600",
    iconBg: "border-emerald-200 bg-emerald-50",
    sources: ["Manuell", "CSV / Excel"],
    createHref: "/dashboard/events/trainings/new",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    key: "OTHER",
    label: "Weitere Events",
    description:
      "Vereinsanlässe wie Generalversammlung, Lager, Party oder Sponsor-Apéro. Primär auf der Website Events-Seite ausgespielt.",
    icon: CalendarDays,
    iconColor: "text-violet-600",
    iconBg: "border-violet-200 bg-violet-50",
    sources: ["Manuell", "CSV / Excel"],
    createHref: "/dashboard/events/other/new",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
  },
] as const;

export default async function EventsPage({ searchParams }: EventsPageProps) {
  await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const availableSeasons = (await getAvailableTeamSeasons()) as SeasonOption[];
  const allEvents = (await getEventsListData()) as EventItem[];

  const fallbackSeason =
    availableSeasons.find((s) => s.isActive)?.key ??
    availableSeasons[0]?.key ??
    "";

  const selectedSeasonKey =
    params.season &&
    availableSeasons.some((s) => s.key === params.season)
      ? params.season
      : fallbackSeason;

  const selectedSeason =
    availableSeasons.find((s) => s.key === selectedSeasonKey) ?? null;

  const submittedMessage = getSubmittedMessage(params.submitted, params.count);

  // Event counts for the selected season
  const seasonEvents = allEvents.filter(
    (e) => e.season?.key === selectedSeasonKey,
  );
  const matchCount = seasonEvents.filter((e) => e.type === "MATCH").length;
  const tournamentCount = seasonEvents.filter(
    (e) => e.type === "TOURNAMENT",
  ).length;
  const trainingCount = seasonEvents.filter(
    (e) => e.type === "TRAINING",
  ).length;
  const otherCount = seasonEvents.filter((e) => e.type === "OTHER").length;

  const typeCounts: Record<string, number> = {
    MATCH: matchCount,
    TOURNAMENT: tournamentCount,
    TRAINING: trainingCount,
    OTHER: otherCount,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminSectionHeader
        eyebrow="Events"
        title="Events"
        description="Saisongeführte Eventverwaltung für Matches, Turniere, Trainings und weitere Vereinsanlässe."
        actions={
          <Link href="/dashboard/events/import" className="fca-button-secondary">
            <Upload className="h-4 w-4" />
            Import
          </Link>
        }
      />

      {/* Feedback */}
      {submittedMessage ? (
        <div className="fca-status-box fca-status-box-success">
          {submittedMessage}
        </div>
      ) : null}

      {/* Architecture hero */}
      <div className="sce-entity-hero">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/60">
              Events Modul
            </p>
            <h3
              className="mt-1 text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {selectedSeason?.name ?? "Saison wählen"}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              Die WebApp ist die führende Quelle für alle Vereins-Events. Daten
              fliessen direkt auf Website, Infoboard, Wochenplan und
              Teamseiten.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:text-center">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                Total
              </p>
              <p
                className="mt-1 text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {seasonEvents.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                Matches
              </p>
              <p
                className="mt-1 text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {matchCount}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                Trainings
              </p>
              <p
                className="mt-1 text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {trainingCount}
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/55">
                Andere
              </p>
              <p
                className="mt-1 text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tournamentCount + otherCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Season selector */}
      <SeasonContextSelector
        title="Saison-Kontext"
        description="Events werden innerhalb der gewählten Saison nach Eventtyp geführt."
        seasons={availableSeasons}
        selectedSeasonKey={selectedSeasonKey}
        basePath="/dashboard/events"
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Matches</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {matchCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedSeason?.name ?? "Saison"}
          </p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Turniere</p>
          <p
            className="mt-1.5 text-2xl font-bold text-amber-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tournamentCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedSeason?.name ?? "Saison"}
          </p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Trainings</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {trainingCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedSeason?.name ?? "Saison"}
          </p>
        </div>

        <div className="sce-kpi-card">
          <p className="sce-data-label">Weitere</p>
          <p
            className="mt-1.5 text-2xl font-bold text-violet-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {otherCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedSeason?.name ?? "Saison"}
          </p>
        </div>
      </div>

      {/* Event type sections */}
      <div className="grid gap-4 xl:grid-cols-2">
        {EVENT_TYPES.map((eventType) => {
          const Icon = eventType.icon;
          const count = typeCounts[eventType.key] ?? 0;

          return (
            <div key={eventType.key} className="sce-detail-section">
              <div className="sce-detail-section-header">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${eventType.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${eventType.iconColor}`} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {eventType.label}
                    </span>
                    <span className="sce-count-badge">{count}</span>
                  </div>
                </div>

                <Link
                  href={eventType.createHref}
                  className="fca-button-primary shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Erstellen
                </Link>
              </div>

              <div className="sce-detail-section-body">
                <p className="text-sm text-[var(--muted)]">
                  {eventType.description}
                </p>

                <div className="mt-4">
                  <p className="sce-data-label mb-2">Datenquellen</p>
                  <div className="flex flex-wrap gap-2">
                    {eventType.sources.map((source) => (
                      <span
                        key={source}
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${eventType.badgeClass}`}
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions footer */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
              <Upload className="h-4 w-4 text-[var(--blue)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Import & Ausspielung
            </span>
          </div>
        </div>

        <div className="sce-detail-section-body">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-[var(--muted)]">
                Events können via CSV/Excel oder ClubCorner importiert werden.
                Nach Freigabe werden sie auf Website, Infoboard und Wochenplan
                ausgespielt.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Website", "Infoboard", "Wochenplan", "Teamseiten"].map(
                  (target) => (
                    <span
                      key={target}
                      className="inline-flex h-5 items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[0.65rem] font-semibold text-[var(--muted)]"
                    >
                      {target}
                    </span>
                  ),
                )}
              </div>
            </div>

            <Link
              href="/dashboard/events/import"
              className="fca-button-secondary shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Zum Import
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
