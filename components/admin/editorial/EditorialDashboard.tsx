"use client";

/**
 * components/admin/editorial/EditorialDashboard.tsx
 *
 * Editorial Center dashboard — CMS V2 Slice 10.
 *
 * Operational command center for CMS editors.
 * Renders all 8 editorial sections: KPI cards, review queue,
 * publishing calendar, health dashboard, activity feed,
 * scheduled publications, draft overview, recently changed content.
 *
 * All data fetched from /api/editorial/overview and /api/editorial/health.
 * No business logic here — pure presentation over existing CMS data.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileEdit,
  FileText,
  Globe,
  Heart,
  History,
  Home,
  Inbox,
  Newspaper,
  RefreshCw,
  Send,
  XCircle,
  Zap,
  Archive,
  Activity,
} from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui/page";
import type {
  EditorialOverviewData,
  EditorialHealthData,
  EditorialEntityType,
  EditorialQueueItem,
  EditorialScheduledItem,
  EditorialDraftItem,
  EditorialRecentItem,
  EditorialActivityItem,
} from "@/lib/cms/editorial/types";
import { EDITORIAL_ENTITY_LABEL } from "@/lib/cms/editorial/types";

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return fmtDate(iso);
}

// ── Entity type icon ──────────────────────────────────────────────────────────

function EntityIcon({ type }: { type: EditorialEntityType | string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (type === "HomepageSection") return <Home className={cls} />;
  if (type === "WebsitePageSection") return <FileText className={cls} />;
  if (type === "WebsitePage") return <Globe className={cls} />;
  if (type === "NewsArticle") return <Newspaper className={cls} />;
  return <FileEdit className={cls} />;
}

// ── Entity chip ───────────────────────────────────────────────────────────────

function EntityChip({ type }: { type: EditorialEntityType | string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      <EntityIcon type={type} />
      {EDITORIAL_ENTITY_LABEL[type as EditorialEntityType] ?? type}
    </span>
  );
}

// ── Workflow status badge ─────────────────────────────────────────────────────

const WORKFLOW_BADGE_CLASS: Record<string, string> = {
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
  DRAFT: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOT_REQUIRED: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  ARCHIVED: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-70",
};

function WorkflowBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const cls = WORKFLOW_BADGE_CLASS[status] ??
    "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--surface-2)] ${className ?? "h-4 w-full"}`}
    />
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  href?: string;
  warning?: boolean;
}

function KpiCard({
  label,
  count,
  icon: Icon,
  colorClass,
  bgClass,
  href,
  warning,
}: KpiCardProps) {
  const content = (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        warning && count > 0
          ? "border-amber-200 bg-amber-50"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--tenant-primary)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-[var(--text-2)] leading-tight">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ── Review queue section ──────────────────────────────────────────────────────

function ReviewQueueSection({
  items,
  loading,
}: {
  items: EditorialQueueItem[];
  loading: boolean;
}) {
  return (
    <SectionCard
      title="Prüfqueue"
      description="Inhalte die eine redaktionelle Prüfung oder Freigabe benötigen."
      headerActions={
        <Link
          href="/dashboard/website/review"
          className="fca-button-secondary text-xs"
        >
          Alle ansehen
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
      noPadding
    >
      {loading ? (
        <div className="px-5 py-4">
          <SectionSkeleton rows={4} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            heading="Prüfqueue ist leer"
            description="Keine Inhalte warten auf Prüfung oder Freigabe."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div
              key={`${item.entityType}:${item.id}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
                <EntityIcon type={item.entityType} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-xs">
                    {item.title}
                  </span>
                  <EntityChip type={item.entityType} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {item.sourceLocation && (
                    <span className="truncate">{item.sourceLocation}</span>
                  )}
                  <span>·</span>
                  <span>{timeAgo(item.updatedAt)}</span>
                  {item.reviewRequestedAt && (
                    <>
                      <span>·</span>
                      <span className="text-blue-600">
                        Eingereicht {timeAgo(item.reviewRequestedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <WorkflowBadge
                  status={item.workflowStatus}
                  label={item.workflowStatusLabel}
                />
                <Link
                  href={item.editUrl}
                  className="fca-button-secondary text-xs py-1 px-2"
                >
                  <Eye className="h-3 w-3" />
                  Öffnen
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Scheduled publications ────────────────────────────────────────────────────

function ScheduledSection({
  items,
  loading,
}: {
  items: EditorialScheduledItem[];
  loading: boolean;
}) {
  return (
    <SectionCard
      title="Geplante Veröffentlichungen"
      description="Inhalte mit geplantem Veröffentlichungsdatum."
      noPadding
    >
      {loading ? (
        <div className="px-5 py-4">
          <SectionSkeleton rows={3} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            icon={<CalendarDays className="h-10 w-10" />}
            heading="Keine geplanten Veröffentlichungen"
            description="Kein Inhalt mit einem geplanten Datum gefunden."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div
              key={`${item.entityType}:${item.id}`}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-xs">
                    {item.title}
                  </span>
                  <EntityChip type={item.entityType} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {item.sourceLocation && (
                    <span className="truncate">{item.sourceLocation}</span>
                  )}
                  <span className="text-amber-700 font-medium">
                    Geplant: {fmtDateTime(item.scheduledAt)}
                  </span>
                  {item.expiresAt && (
                    <span className="text-red-600">
                      · Läuft ab: {fmtDate(item.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <WorkflowBadge
                  status="SCHEDULED"
                  label="Geplant"
                />
                <Link
                  href={item.editUrl}
                  className="fca-button-secondary text-xs py-1 px-2"
                >
                  <Eye className="h-3 w-3" />
                  Öffnen
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Draft overview ────────────────────────────────────────────────────────────

function DraftSection({
  items,
  loading,
}: {
  items: EditorialDraftItem[];
  loading: boolean;
}) {
  const oldDrafts = items.filter((i) => i.isOld);
  const recentDrafts = items.filter((i) => !i.isOld);

  return (
    <SectionCard
      title="Entwürfe"
      description="Unveröffentlichte Inhalte in Bearbeitung."
      headerActions={
        <Link
          href="/dashboard/website/publishing"
          className="fca-button-secondary text-xs"
        >
          Alle in Veröffentlichungen
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
      noPadding
    >
      {loading ? (
        <div className="px-5 py-4">
          <SectionSkeleton rows={4} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            icon={<FileEdit className="h-10 w-10" />}
            heading="Keine Entwürfe"
            description="Alle Inhalte sind veröffentlicht oder archiviert."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {oldDrafts.length > 0 && (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Alte Entwürfe (&gt; 30 Tage)
              </p>
            </div>
          )}
          {items.map((item) => (
            <div
              key={`${item.entityType}:${item.id}`}
              className={`flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors ${
                item.isOld ? "bg-amber-50/40" : ""
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  item.isOld
                    ? "bg-amber-100 text-amber-700"
                    : "bg-[var(--surface-2)] text-[var(--muted)]"
                }`}
              >
                <FileEdit className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-xs">
                    {item.title}
                  </span>
                  <EntityChip type={item.entityType} />
                  {item.isOld && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {item.ageInDays}d alt
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {item.sourceLocation && (
                    <span className="truncate">{item.sourceLocation}</span>
                  )}
                  <span>Geändert {timeAgo(item.updatedAt)}</span>
                </div>
              </div>
              <Link
                href={item.editUrl}
                className="fca-button-secondary text-xs py-1 px-2 shrink-0"
              >
                <FileEdit className="h-3 w-3" />
                Bearbeiten
              </Link>
            </div>
          ))}
          {recentDrafts.length === 0 && oldDrafts.length > 0 && null}
        </div>
      )}
    </SectionCard>
  );
}

// ── Publishing calendar (schedule + expiry overview) ─────────────────────────

function CalendarSection({
  scheduled,
  loading,
}: {
  scheduled: EditorialScheduledItem[];
  loading: boolean;
}) {
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const thisWeek = scheduled.filter(
    (i) => i.scheduledAt && new Date(i.scheduledAt) <= in7days,
  );
  const next30days = scheduled.filter(
    (i) =>
      i.scheduledAt &&
      new Date(i.scheduledAt) > in7days &&
      new Date(i.scheduledAt) <= in30days,
  );
  const later = scheduled.filter(
    (i) => i.scheduledAt && new Date(i.scheduledAt) > in30days,
  );

  return (
    <SectionCard
      title="Veröffentlichungsplan"
      description="Zeitlicher Überblick geplanter Veröffentlichungen."
    >
      {loading ? (
        <SectionSkeleton rows={3} />
      ) : scheduled.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          heading="Kein Veröffentlichungsplan"
          description="Keine Inhalte mit geplantem Veröffentlichungsdatum."
        />
      ) : (
        <div className="space-y-4">
          {thisWeek.length > 0 && (
            <CalendarGroup label="Diese Woche" items={thisWeek} accent="amber" />
          )}
          {next30days.length > 0 && (
            <CalendarGroup label="Nächste 30 Tage" items={next30days} accent="blue" />
          )}
          {later.length > 0 && (
            <CalendarGroup label="Später" items={later} accent="default" />
          )}
        </div>
      )}
    </SectionCard>
  );
}

function CalendarGroup({
  label,
  items,
  accent,
}: {
  label: string;
  items: EditorialScheduledItem[];
  accent: "amber" | "blue" | "default";
}) {
  const accentClasses = {
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    default: "text-[var(--muted)] bg-[var(--surface-2)] border-[var(--border)]",
  };

  return (
    <div>
      <div
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-2 ${accentClasses[accent]}`}
      >
        {label} — {items.length}
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={`${item.entityType}:${item.id}`}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <EntityIcon type={item.entityType} />
            <span className="flex-1 text-sm text-[var(--foreground)] truncate min-w-0">
              {item.title}
            </span>
            <span className="text-xs text-amber-700 font-medium shrink-0">
              {fmtDateTime(item.scheduledAt)}
            </span>
            <Link
              href={item.editUrl}
              className="text-xs text-[var(--tenant-primary)] hover:underline shrink-0"
            >
              Öffnen
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Content health dashboard ──────────────────────────────────────────────────

function HealthSection({
  data,
  loading,
}: {
  data: EditorialHealthData | null;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const ISSUE_ICON: Record<string, React.ElementType> = {
    old_draft: Clock,
    disabled_published: AlertTriangle,
    expired_enabled: XCircle,
    page_no_sections: FileText,
    page_all_disabled: EyeOff,
    section_missing_label: AlertTriangle,
    recently_restored: History,
  };

  const ISSUE_COLOR: Record<string, string> = {
    old_draft: "text-amber-600 bg-amber-50",
    disabled_published: "text-orange-600 bg-orange-50",
    expired_enabled: "text-red-600 bg-red-50",
    page_no_sections: "text-blue-600 bg-blue-50",
    page_all_disabled: "text-slate-600 bg-slate-50",
    section_missing_label: "text-amber-600 bg-amber-50",
    recently_restored: "text-violet-600 bg-violet-50",
  };

  return (
    <SectionCard
      title="Inhaltliche Hinweise"
      description="Qualitäts- und Konsistenzprüfungen für CMS-Inhalte."
    >
      {loading ? (
        <SectionSkeleton rows={4} />
      ) : !data || data.issues.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          heading="Keine Hinweise"
          description="Alle CMS-Inhalte sind in gutem Zustand."
        />
      ) : (
        <div className="space-y-2">
          {data.issues.map((issue) => {
            const Icon = ISSUE_ICON[issue.type] ?? AlertTriangle;
            const colorCls = ISSUE_COLOR[issue.type] ?? "text-amber-600 bg-amber-50";
            const isExpanded = expanded === issue.type;

            return (
              <div
                key={issue.type}
                className="rounded-lg border border-[var(--border)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(isExpanded ? null : issue.type)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorCls}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {issue.label}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{issue.description}</p>
                  </div>
                  <span
                    className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold ${colorCls}`}
                  >
                    {issue.count}
                  </span>
                  <ArrowRight
                    className={`h-4 w-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>

                {isExpanded && issue.items.length > 0 && (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                    {issue.items.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-b-0"
                      >
                        <EntityChip type={item.entityType} />
                        <span className="flex-1 text-sm text-[var(--foreground)] truncate min-w-0">
                          {item.title}
                        </span>
                        <span className="text-xs text-[var(--muted)] shrink-0">
                          {item.detail}
                        </span>
                        <Link
                          href={item.editUrl}
                          className="text-xs text-[var(--tenant-primary)] hover:underline shrink-0"
                        >
                          Bearbeiten
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  APPROVAL_REQUEST: { icon: Send, cls: "bg-blue-50 text-blue-600" },
  SUBMIT_REVIEW: { icon: Send, cls: "bg-blue-50 text-blue-600" },
  APPROVE: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  REJECT: { icon: XCircle, cls: "bg-red-50 text-red-600" },
  REQUEST_CHANGES: { icon: XCircle, cls: "bg-red-50 text-red-600" },
  PUBLISH: { icon: Globe, cls: "bg-emerald-50 text-emerald-600" },
  UNPUBLISH: { icon: EyeOff, cls: "bg-amber-50 text-amber-600" },
  SCHEDULE: { icon: CalendarDays, cls: "bg-amber-50 text-amber-600" },
  ARCHIVE: { icon: Archive, cls: "bg-[var(--surface-2)] text-[var(--muted)]" },
  RESTORE: { icon: History, cls: "bg-violet-50 text-violet-600" },
  UPDATE: { icon: FileEdit, cls: "bg-[var(--surface-2)] text-[var(--muted)]" },
};

function ActivityFeedSection({
  items,
  loading,
}: {
  items: EditorialActivityItem[];
  loading: boolean;
}) {
  return (
    <SectionCard
      title="Aktivität"
      description="Letzte redaktionelle Aktionen aus Prüfung und Veröffentlichung."
    >
      {loading ? (
        <SectionSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-10 w-10" />}
          heading="Keine Aktivität"
          description="Noch keine redaktionellen Aktionen protokolliert."
        />
      ) : (
        <div className="space-y-0">
          {items.map((item, i) => {
            const actionMeta = ACTION_ICON[item.action] ?? {
              icon: Activity,
              cls: "bg-[var(--surface-2)] text-[var(--muted)]",
            };
            const Icon = actionMeta.icon;

            return (
              <div key={item.id} className="flex items-start gap-3 py-3 relative">
                {/* Timeline line */}
                {i < items.length - 1 && (
                  <div className="absolute left-3.5 top-10 bottom-0 w-px bg-[var(--border)]" />
                )}
                <div
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${actionMeta.cls}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {item.actionLabel}
                    </span>
                    <EntityChip type={item.entityType} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-[var(--muted)]">
                    {item.actorName && <span>{item.actorName}</span>}
                    {item.actorName && <span>·</span>}
                    <span>{timeAgo(item.createdAt)}</span>
                    {item.editUrl && (
                      <>
                        <span>·</span>
                        <Link
                          href={item.editUrl}
                          className="text-[var(--tenant-primary)] hover:underline"
                        >
                          Anzeigen
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ── Recently changed ──────────────────────────────────────────────────────────

function RecentlyChangedSection({
  items,
  loading,
}: {
  items: EditorialRecentItem[];
  loading: boolean;
}) {
  return (
    <SectionCard
      title="Zuletzt geändert"
      description="Inhalte die kürzlich bearbeitet wurden."
      noPadding
    >
      {loading ? (
        <div className="px-5 py-4">
          <SectionSkeleton rows={5} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            icon={<History className="h-10 w-10" />}
            heading="Keine Änderungen"
            description="Noch keine CMS-Inhalte bearbeitet."
          />
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
                <EntityIcon type={item.entityType} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-medium text-[var(--foreground)] truncate max-w-xs">
                    {item.title}
                  </span>
                  <EntityChip type={item.entityType} />
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  {item.actorName && <span>{item.actorName}</span>}
                  {item.actorName && <span>·</span>}
                  <span>{timeAgo(item.changedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <WorkflowBadge
                  status={item.publishStatus}
                  label={item.publishStatusLabel}
                />
                <Link
                  href={item.editUrl}
                  className="fca-button-secondary text-xs py-1 px-2"
                >
                  <Eye className="h-3 w-3" />
                  Öffnen
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function EditorialDashboard() {
  const [overview, setOverview] = useState<EditorialOverviewData | null>(null);
  const [health, setHealth] = useState<EditorialHealthData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/editorial/overview");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EditorialOverviewData = await res.json();
      setOverview(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setOverviewError("Daten konnten nicht geladen werden.");
      console.error("[Editorial] overview error:", err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/editorial/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EditorialHealthData = await res.json();
      setHealth(data);
    } catch (err) {
      console.error("[Editorial] health error:", err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    void loadHealth();
  }, [loadOverview, loadHealth]);

  if (overviewError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <XCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="text-sm font-medium text-red-700">{overviewError}</p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="mt-3 fca-button-secondary text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          Erneut versuchen
        </button>
      </div>
    );
  }

  const kpis = overview?.kpis;

  return (
    <div className="space-y-6">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          Zuletzt aktualisiert: {lastRefreshed.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <button
          type="button"
          onClick={() => {
            void loadOverview();
            void loadHealth();
          }}
          disabled={overviewLoading}
          className="fca-button-secondary text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${overviewLoading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {/* KPI Cards */}
      {overviewLoading && !overview ? (
        <KpiSkeleton />
      ) : kpis ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <KpiCard
            label="Entwürfe"
            count={kpis.drafts}
            icon={FileEdit}
            colorClass="text-[var(--foreground)]"
            bgClass="bg-[var(--surface-2)]"
            href="/dashboard/website/publishing?status=DRAFT"
          />
          <KpiCard
            label="Zur Prüfung"
            count={kpis.inReview}
            icon={Inbox}
            colorClass="text-blue-700"
            bgClass="bg-blue-50"
            href="/dashboard/website/review"
          />
          <KpiCard
            label="Geplant"
            count={kpis.scheduled}
            icon={CalendarDays}
            colorClass="text-amber-700"
            bgClass="bg-amber-50"
          />
          <KpiCard
            label="Veröffentlicht"
            count={kpis.published}
            icon={Globe}
            colorClass="text-emerald-700"
            bgClass="bg-emerald-50"
            href="/dashboard/website/publishing?status=PUBLISHED"
          />
          <KpiCard
            label="Archiviert"
            count={kpis.archived}
            icon={Archive}
            colorClass="text-[var(--muted)]"
            bgClass="bg-[var(--surface-2)]"
            href="/dashboard/website/publishing?status=ARCHIVED"
          />
          <KpiCard
            label="Läuft bald ab"
            count={kpis.expiringSoon}
            icon={AlertTriangle}
            colorClass={kpis.expiringSoon > 0 ? "text-red-700" : "text-[var(--muted)]"}
            bgClass={kpis.expiringSoon > 0 ? "bg-red-50" : "bg-[var(--surface-2)]"}
            warning={kpis.expiringSoon > 0}
          />
          <KpiCard
            label="Revisionen (24h)"
            count={kpis.recentRevisions}
            icon={Zap}
            colorClass="text-violet-700"
            bgClass="bg-violet-50"
          />
        </div>
      ) : null}

      {/* Main grid — 2 columns on large screens */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Review queue + Scheduled */}
        <div className="space-y-6">
          <ReviewQueueSection
            items={overview?.reviewQueue ?? []}
            loading={overviewLoading}
          />
          <ScheduledSection
            items={overview?.scheduledPublications ?? []}
            loading={overviewLoading}
          />
        </div>

        {/* Drafts + Calendar */}
        <div className="space-y-6">
          <DraftSection
            items={overview?.drafts ?? []}
            loading={overviewLoading}
          />
          <CalendarSection
            scheduled={overview?.scheduledPublications ?? []}
            loading={overviewLoading}
          />
        </div>
      </div>

      {/* Health + Activity + Recent — full width */}
      <HealthSection data={health} loading={healthLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ActivityFeedSection
          items={overview?.activity ?? []}
          loading={overviewLoading}
        />
        <RecentlyChangedSection
          items={overview?.recentlyChanged ?? []}
          loading={overviewLoading}
        />
      </div>
    </div>
  );
}
