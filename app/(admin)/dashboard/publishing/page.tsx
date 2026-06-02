import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Dumbbell,
  ExternalLink,
  Newspaper,
  UserCircle,
  Users,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import ReviewStageBadge from "@/components/admin/shared/ReviewStageBadge";
import {
  getPublishingKpiCounts,
  getRecentEventsInPipeline,
} from "@/lib/publishing/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  MATCH: "Match",
  TOURNAMENT: "Turnier",
  TRAINING: "Training",
  OTHER: "Anderes",
  VACATION_PERIOD: "Ferienperiode",
};

function formatEventType(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

// ---------------------------------------------------------------------------
// Stage configuration — colours mirror ReviewStageBadge / STAGE_META
// ---------------------------------------------------------------------------

const KPI_STAGE_CONFIG = [
  {
    key: "draft" as const,
    label: "Entwurf",
    sublabel: "In Bearbeitung",
    valueColor: "text-slate-600",
    dotColor: "bg-slate-400",
    chipBorder: "border-slate-200",
    chipBg: "bg-slate-50",
    chipText: "text-slate-600",
  },
  {
    key: "submitted" as const,
    label: "Zur Prüfung",
    sublabel: "Warten auf Review",
    valueColor: "text-amber-700",
    dotColor: "bg-amber-500",
    chipBorder: "border-amber-200",
    chipBg: "bg-amber-50",
    chipText: "text-amber-700",
  },
  {
    key: "approved" as const,
    label: "Genehmigt",
    sublabel: "Bereit zur Freigabe",
    valueColor: "text-emerald-700",
    dotColor: "bg-emerald-500",
    chipBorder: "border-emerald-200",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
  },
  {
    key: "published" as const,
    label: "Veröffentlicht",
    sublabel: "Live ausgespielt",
    valueColor: "text-[#0b4aa2]",
    dotColor: "bg-[var(--blue)]",
    chipBorder: "border-blue-200",
    chipBg: "bg-blue-50",
    chipText: "text-[#0b4aa2]",
  },
] as const;

// ---------------------------------------------------------------------------
// Placeholder section definitions
// ---------------------------------------------------------------------------

const PLACEHOLDER_SECTIONS = [
  {
    key: "news",
    label: "News",
    description:
      "Vereinsnews mit Review-Pipeline — Artikelverwaltung, Redaktionsfreigabe und kanalspezifische Ausspielung.",
    Icon: Newspaper,
  },
  {
    key: "teams",
    label: "Teams",
    description:
      "Teaminhalte mit Review-Pipeline — Teamseiten, Kaderinfos und Teamvorstellungen.",
    Icon: Users,
  },
  {
    key: "players",
    label: "Spieler",
    description:
      "Spielerprofile im Veröffentlichungsworkflow — Stammdaten und öffentliche Profilseiten.",
    Icon: UserCircle,
  },
  {
    key: "trainers",
    label: "Trainer",
    description:
      "Trainersteckbriefe im Publishing-Prozess — Profil, Qualifikationen und Teamzuweisung.",
    Icon: Dumbbell,
  },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublishingCockpitPage() {
  await requireAnyPermission([
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
    PERMISSIONS.INFOBOARD_MANAGE,
  ]);

  const [kpiCounts, recentEvents] = await Promise.all([
    getPublishingKpiCounts(),
    getRecentEventsInPipeline(8),
  ]);

  const kpiValues: Record<string, number> = {
    draft: kpiCounts.draft,
    submitted: kpiCounts.submitted,
    approved: kpiCounts.approved,
    published: kpiCounts.published,
  };

  const totalEvents =
    kpiCounts.draft +
    kpiCounts.submitted +
    kpiCounts.approved +
    kpiCounts.published;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <AdminSectionHeader
        eyebrow="Ausspielung"
        title="Publishing Cockpit"
        description="Zentraler Überblick über den Review-Workflow für alle Vereinsinhalte — Events, News, Teams, Spieler und Trainer."
      />

      {/* ── KPI Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_STAGE_CONFIG.map((stage) => (
          <div key={stage.key} className="sce-kpi-card">
            <p className="sce-data-label">{stage.label}</p>
            <p
              className={`mt-1.5 text-[1.9rem] font-bold leading-none tracking-tight ${stage.valueColor}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {kpiValues[stage.key]}
            </p>
            <p className="mt-2 text-[0.75rem] text-[var(--text-2)]">
              {stage.sublabel}
            </p>
          </div>
        ))}
      </div>

      {/* ── Events section ─────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
              <CalendarDays className="h-4 w-4 text-[var(--blue)]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Events
              </span>
              <span className="sce-count-badge">{totalEvents}</span>
            </div>
          </div>
          <Link
            href="/dashboard/events"
            className="fca-button-secondary shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Events-Modul
          </Link>
        </div>

        <div className="sce-detail-section-body space-y-5">
          {/* Stage distribution */}
          <div>
            <p className="sce-data-label mb-3">Verteilung nach Review-Status</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KPI_STAGE_CONFIG.map((stage) => (
                <div
                  key={stage.key}
                  className={`flex items-center gap-2.5 rounded-lg border ${stage.chipBorder} ${stage.chipBg} px-3 py-2.5`}
                >
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${stage.dotColor}`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-bold leading-none ${stage.chipText}`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {kpiValues[stage.key]}
                    </p>
                    <p className="mt-0.5 truncate text-[0.65rem] text-[var(--muted)]">
                      {stage.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent items in pipeline */}
          <div>
            <p className="sce-data-label mb-3">
              Zuletzt aktualisiert — Review-Pipeline
            </p>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Keine Events in der Review-Pipeline.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {formatEventType(event.type)}
                        {event.seasonName ? ` · ${event.seasonName}` : ""}
                        {event.teamName ? ` · ${event.teamName}` : ""}
                        {" · "}
                        {formatDate(event.updatedAt)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ReviewStageBadge stage={event.reviewStage} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Placeholder content modules ────────────────────────────────── */}
      <div>
        <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Weitere Inhaltsbereiche
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLACEHOLDER_SECTIONS.map(({ key, label, description, Icon }) => (
            <div
              key={key}
              className="sce-detail-section opacity-60 transition-opacity hover:opacity-80"
            >
              <div className="sce-detail-section-header">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
                    <Icon className="h-4 w-4 text-[var(--muted)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {label}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-3 w-3" />
                  Demnächst
                </span>
              </div>
              <div className="sce-detail-section-body">
                <p className="text-sm text-[var(--muted)]">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
