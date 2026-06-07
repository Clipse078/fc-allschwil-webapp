"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Inbox,
  PenLine,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Archive,
  Newspaper,
  FileText,
} from "lucide-react";
import type {
  FilterContentType,
  FilterStatus,
  PublishableContentType,
  PublishableItem,
  PublishingOverviewResponse,
  PublishingStatus,
  PublishingStatusCounts,
} from "@/lib/publishing/types";
import {
  CONTENT_TYPE_LABEL,
  PUBLISHING_STATUS_BADGE_CLASS,
  PUBLISHING_STATUS_CARD,
  PUBLISHING_STATUS_LABEL,
} from "@/lib/publishing/types";
import { SectionCard, EmptyState } from "@/components/ui/page";

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PublishingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PUBLISHING_STATUS_BADGE_CLASS[status]}`}
    >
      {PUBLISHING_STATUS_LABEL[status]}
    </span>
  );
}

// ── Type chip ──────────────────────────────────────────────────────────────────

function TypeChip({ type }: { type: PublishableContentType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
      {type === "news" ? (
        <Newspaper className="h-2.5 w-2.5" />
      ) : (
        <FileText className="h-2.5 w-2.5" />
      )}
      {CONTENT_TYPE_LABEL[type]}
    </span>
  );
}

// ── Status summary cards ───────────────────────────────────────────────────────

const STATUS_ORDER: PublishingStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

function StatusCards({
  counts,
  activeStatus,
  onSelect,
}: {
  counts: PublishingStatusCounts;
  activeStatus: FilterStatus;
  onSelect: (s: FilterStatus) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STATUS_ORDER.map((s) => {
        const { cardBg, countColor, borderColor } = PUBLISHING_STATUS_CARD[s];
        const isActive = activeStatus === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(isActive ? "ALL" : s)}
            className={`rounded-[var(--radius-xl)] border p-4 text-left transition hover:shadow-sm ${cardBg} ${borderColor} ${
              isActive ? "ring-2 ring-offset-1 ring-[var(--tenant-primary,theme(colors.blue.500))]" : ""
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              {PUBLISHING_STATUS_LABEL[s]}
            </p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${countColor}`}>
              {counts[s]}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ── Workflow action buttons ────────────────────────────────────────────────────

type WorkflowActionProps = {
  item: PublishableItem;
  approvedDataOnly: boolean;
  canManageNews: boolean;
  canManagePages: boolean;
  pending: boolean;
  onAction: (item: PublishableItem, action: string, notes?: string) => void;
};

function WorkflowActions({
  item,
  approvedDataOnly,
  canManageNews,
  canManagePages,
  pending,
  onAction,
}: WorkflowActionProps) {
  const canAct =
    (item.type === "news" && canManageNews) ||
    (item.type === "page" && canManagePages);

  if (!canAct) return null;

  const { status } = item;

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Edit link — always shown */}
      <Link
        href={item.editHref}
        className="sce-icon-button"
        title="Bearbeiten"
      >
        <PenLine className="h-3.5 w-3.5" />
      </Link>

      {/* Submit for review (when approvedDataOnly and status is DRAFT or ARCHIVED) */}
      {approvedDataOnly && (status === "DRAFT" || status === "ARCHIVED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction(item, "submit")}
          className="sce-icon-button text-blue-600 hover:text-blue-800"
          title="Zur Prüfung einreichen"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Approve — when IN_REVIEW */}
      {status === "IN_REVIEW" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction(item, "approve")}
          className="sce-icon-button text-emerald-600 hover:text-emerald-800"
          title="Genehmigen & veröffentlichen"
        >
          <CheckCircle className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Reject — when IN_REVIEW */}
      {status === "IN_REVIEW" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const notes = window.prompt("Ablehnungsgrund (optional):");
            if (notes === null) return; // cancelled
            onAction(item, "reject", notes);
          }}
          className="sce-icon-button text-rose-600 hover:text-rose-800"
          title="Ablehnen"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Direct publish — when NOT approvedDataOnly and DRAFT/SCHEDULED/ARCHIVED */}
      {!approvedDataOnly &&
        (status === "DRAFT" || status === "SCHEDULED" || status === "ARCHIVED") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction(item, "publish")}
            className="sce-icon-button text-emerald-600 hover:text-emerald-800"
            title="Veröffentlichen"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}

      {/* Unpublish — when PUBLISHED */}
      {status === "PUBLISHED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onAction(item, "unpublish")}
          className="sce-icon-button"
          title="Depublizieren (zurück zu Entwurf)"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Archive — when PUBLISHED or DRAFT */}
      {(status === "PUBLISHED" || status === "DRAFT") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Inhalt archivieren?")) return;
            onAction(item, "archive");
          }}
          className="sce-icon-button text-[var(--muted)] hover:text-[var(--foreground)]"
          title="Archivieren"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const TYPE_TABS: { label: string; value: FilterContentType }[] = [
  { label: "Alle", value: "ALL" },
  { label: "News", value: "news" },
  { label: "Seiten", value: "page" },
];

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "Alle", value: "ALL" },
  { label: "Entwurf", value: "DRAFT" },
  { label: "In Prüfung", value: "IN_REVIEW" },
  { label: "Geplant", value: "SCHEDULED" },
  { label: "Veröffentlicht", value: "PUBLISHED" },
  { label: "Archiviert", value: "ARCHIVED" },
];

export default function PublishingCenter() {
  const [data, setData] = useState<PublishingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FilterContentType>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        status: statusFilter,
        limit: "100",
        offset: "0",
      });
      const res = await fetch(`/api/publishing/overview?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Ladefehler");
      setData(json as PublishingOverviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(item: PublishableItem, action: string, notes?: string) {
    setActionPending(item.id);
    setActionError(null);
    try {
      const endpoint =
        item.type === "news"
          ? `/api/news/${item.id}/publish`
          : `/api/website-pages/${item.id}/publish`;

      const qs = action !== "publish" ? `?action=${action}` : "";
      const bodyData = action === "reject" && notes !== undefined ? { notes } : undefined;
      const res = await fetch(`${endpoint}${qs}`, {
        method: "POST",
        headers: bodyData ? { "Content-Type": "application/json" } : undefined,
        body: bodyData ? JSON.stringify(bodyData) : undefined,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json?.error ?? "Aktion fehlgeschlagen.");
        return;
      }

      // Refresh data after successful action
      await load();
    } finally {
      setActionPending(null);
    }
  }

  function handleStatusCardClick(s: FilterStatus) {
    setStatusFilter(s);
  }

  const counts = data?.counts;
  const displayCounts: PublishingStatusCounts | null = counts
    ? typeFilter === "news"
      ? counts.news
      : typeFilter === "page"
        ? counts.pages
        : counts.all
    : null;

  const context = data?.context;
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      {/* Load error banner */}
      {error && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Action error banner */}
      {actionError && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-3 text-xs text-rose-500 underline hover:text-rose-700"
          >
            Schliessen
          </button>
        </div>
      )}

      {/* Status summary cards */}
      {displayCounts ? (
        <StatusCards
          counts={displayCounts}
          activeStatus={statusFilter}
          onSelect={handleStatusCardClick}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUS_ORDER.map((s) => (
            <div
              key={s}
              className="h-20 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      )}

      {/* Content section card: filters + table + footer */}
      <SectionCard noPadding>
        {/* Filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          {/* Type tabs */}
          <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={`rounded-md px-3 py-1.5 transition ${
                  typeFilter === t.value
                    ? "bg-[var(--surface)] shadow-sm sce-filter-tab-active"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Status quick-filter pills — desktop */}
            <div className="hidden md:inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs font-medium">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    statusFilter === f.value
                      ? "bg-[var(--surface)] shadow-sm sce-filter-tab-active"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status select — mobile */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="md:hidden fca-input py-1.5 px-2 text-xs"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Refresh */}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="fca-button-secondary px-2.5"
              title="Aktualisieren"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table body */}
        {loading && items.length === 0 ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-[var(--radius-xl)] bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10" />}
            heading="Keine Inhalte in dieser Ansicht"
            description="Passen Sie die Filter an oder erstellen Sie neuen Inhalt."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Typ
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Titel
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Status
                  </th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Autor
                  </th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Geändert
                  </th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Veröff. / Geplant
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    className="bg-[var(--surface)] transition hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <TypeChip type={item.type} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={item.editHref} className="group">
                        <p className="line-clamp-1 font-medium text-[var(--foreground)] group-hover:text-[var(--tenant-primary)] group-hover:underline">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">{item.slug}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-[11px] text-[var(--muted)]">
                      {item.authorDisplay ?? "–"}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-[11px] text-[var(--muted)]">
                      {fmtDate(item.updatedAt)}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-[11px] text-[var(--muted)]">
                      {fmtDate(item.publishedAt ?? item.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <WorkflowActions
                        item={item}
                        approvedDataOnly={context?.approvedDataOnly ?? false}
                        canManageNews={context?.canManageNews ?? false}
                        canManagePages={context?.canManagePages ?? false}
                        pending={actionPending === item.id}
                        onAction={handleAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Count footer */}
        {!loading && meta && meta.total > 0 && (
          <div className="border-t border-[var(--border)] px-5 py-3">
            <p className="text-[11px] text-[var(--muted)]">
              {items.length} von {meta.total} Einträgen geladen
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
