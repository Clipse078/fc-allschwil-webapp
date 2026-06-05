import type { WebsiteStatusSummary } from "@/lib/website/queries";
import {
  Globe,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  FileEdit,
  ArrowUpRight,
  Newspaper,
  Users,
  CalendarDays,
  Calendar,
  Award,
  Layout,
} from "lucide-react";
import Link from "next/link";

// ── Section type meta ─────────────────────────────────────────────────────────

const SECTION_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; quickLinkHref: string; quickLinkLabel: string }
> = {
  TEAMS: {
    icon: Users,
    quickLinkHref: "/dashboard/teams",
    quickLinkLabel: "Teams",
  },
  EVENTS: {
    icon: CalendarDays,
    quickLinkHref: "/dashboard/events",
    quickLinkLabel: "Events",
  },
  WEEKPLAN: {
    icon: Calendar,
    quickLinkHref: "/dashboard/planner/week",
    quickLinkLabel: "Wochenplanner",
  },
  NEWS: {
    icon: Newspaper,
    quickLinkHref: "#",
    quickLinkLabel: "News (kommt bald)",
  },
  SPONSORS: {
    icon: Award,
    quickLinkHref: "#",
    quickLinkLabel: "Sponsoren (kommt bald)",
  },
  CONTENT: {
    icon: Layout,
    quickLinkHref: "#",
    quickLinkLabel: "Inhalte (kommt bald)",
  },
};

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_DISPLAY: Record<
  string,
  { label: string; badgeClass: string; dotClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: {
    label: "Entwurf",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
    icon: FileEdit,
  },
  IN_REVIEW: {
    label: "In Prüfung",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-400",
    icon: Clock,
  },
  APPROVED: {
    label: "Freigegeben",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    icon: CheckCircle,
  },
  PUBLISHED: {
    label: "Publiziert",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    icon: Eye,
  },
  UNPUBLISHED: {
    label: "Offline",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-400",
    icon: EyeOff,
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_DISPLAY[status] ?? STATUS_DISPLAY.DRAFT;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${meta.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  summary: WebsiteStatusSummary;
};

export default function WebsiteDashboardPanel({ summary }: Props) {
  const { config, sections } = summary;

  return (
    <div className="space-y-8">
      {/* ── Publishing status overview ───────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Publikationsstatus
            </span>
          </div>
          <div className="flex items-center gap-2">
            {config.websiteEnabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Website aktiv
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Website deaktiviert
              </span>
            )}
            {config.approvedDataOnly && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Nur freigegebene Daten
              </span>
            )}
          </div>
        </div>
        <div className="sce-detail-section-body">
          {config.websiteDomain && (
            <p className="mb-4 text-sm text-[var(--text-2)]">
              Domain:{" "}
              <a
                href={`https://${config.websiteDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--blue)] hover:underline"
              >
                {config.websiteDomain}
                <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
              </a>
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Publiziert"
              value={summary.publishedCount}
              accent="text-emerald-600"
            />
            <StatCard
              label="Freigegeben"
              value={summary.approvedCount}
              accent="text-blue-600"
            />
            <StatCard
              label="In Prüfung"
              value={summary.inReviewCount}
              accent="text-amber-600"
            />
            <StatCard
              label="Entwurf"
              value={summary.draftCount}
              accent="text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* ── Sections overview ────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Website-Sektionen
          </span>
          <Link
            href="/dashboard/website/sections"
            className="text-[12px] font-medium text-[var(--blue)] hover:underline"
          >
            Alle verwalten →
          </Link>
        </div>
        <div className="sce-detail-section-body">
          <div className="divide-y divide-[var(--border)]">
            {sections.map((section) => {
              const meta = SECTION_META[section.sectionType] ?? SECTION_META.CONTENT;
              const Icon = meta.icon;
              return (
                <div
                  key={section.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
                    <Icon className="h-4 w-4 text-[var(--text-2)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {section.label ?? section.sectionType}
                    </p>
                    {section.lastPublishedAt && (
                      <p className="text-[11px] text-[var(--muted)]">
                        Zuletzt publiziert:{" "}
                        {new Date(section.lastPublishedAt).toLocaleDateString("de-CH")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!section.isEnabled && (
                      <span className="text-[11px] text-[var(--muted)]">deaktiviert</span>
                    )}
                    <StatusBadge status={section.status} />
                    {meta.quickLinkHref !== "#" && (
                      <Link
                        href={meta.quickLinkHref}
                        className="shrink-0 text-[11px] font-medium text-[var(--blue)] hover:underline"
                        title={`Zu ${meta.quickLinkLabel}`}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Schnellzugriff
          </span>
        </div>
        <div className="sce-detail-section-body">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(SECTION_META)
              .filter(([, meta]) => meta.quickLinkHref !== "#")
              .map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <Link
                    key={type}
                    href={meta.quickLinkHref}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {meta.quickLinkLabel}
                    </span>
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
                  </Link>
                );
              })}
            <Link
              href="/dashboard/website/sections"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <Globe className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Sektionen verwalten
              </span>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
            </Link>
            <Link
              href="/dashboard/website/settings"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
            >
              <Layout className="h-4 w-4 shrink-0 text-[var(--text-2)]" />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Website-Einstellungen
              </span>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-[var(--muted)]" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
