"use client";

/**
 * PUB-WEEKPLAN-VISIBILITY-01 — MatchCenter Wochenplan Bulk Panel
 * MATCHCENTER-UX-03-C2 — Premium match list: unified control toolbar
 *
 * Client component that wraps the Spielplanung match list with:
 *   - Unified control toolbar: Status | Wochenplan | Ansicht + Wochenplan verwalten
 *   - Per-match Wochenplan publication indicator
 *   - Multi-select bulk management mode
 *   - Checkbox selection per match row
 *   - Contextual bulk action bar
 *   - Matchday grouping (CenterDateGroup)
 *   - Match inspector (MatchInspector via Sheet)
 *   - Density toggle (Komfortabel / Kompakt)
 *   - Optimistic UI update after mutation
 *
 * Uses POST /api/matchcenter/bulk-wochenplan-visibility.
 * Falls back gracefully when canManage=false (read-only view).
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  SquareCheck,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { CenterDateGroup } from "@/components/centers/CenterDateGroup";
import { MatchCard, type MatchCardDensity } from "./MatchCard";
import { MatchInspector } from "./MatchInspector";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import {
  buildMatchcenterHref,
} from "@/lib/matchcenter/navigation";
import type {
  MatchcenterRowViewModel,
  MatchcenterActionFilter,
  MatchcenterTab,
  MatchcenterWochenplanFilter,
} from "@/lib/matchcenter/view-model";
import { cn } from "@/lib/cn";

// ── Filter constants ─────────────────────────────────────────────────────────

const ACTION_FILTERS: { key: MatchcenterActionFilter; label: string }[] = [
  { key: "ALLE", label: "Alle" },
  { key: "OFFEN", label: "Offen" },
  { key: "ERLEDIGT", label: "Bereit" },
];

const WOCHENPLAN_FILTERS: { key: MatchcenterWochenplanFilter; label: string }[] = [
  { key: "ALLE", label: "Alle" },
  { key: "IM_WOCHENPLAN", label: "Im Wochenplan" },
  { key: "NICHT_IM_WOCHENPLAN", label: "Nicht im Wochenplan" },
];

function buildHref(
  basePath: string,
  params: {
    tab: MatchcenterTab;
    month: string;
    actionFilter: MatchcenterActionFilter;
    wochenplanFilter: MatchcenterWochenplanFilter;
    teamFilter: string | null;
  },
): string {
  return buildMatchcenterHref(basePath, params);
}

// ── Day-grouping utility ─────────────────────────────────────────────────────

type DayGroup = {
  dayKey: string;
  label: string;
  rows: MatchcenterRowViewModel[];
};

function formatDayGroupLabel(date: Date, locale: string, timezone: string): string {
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: timezone,
  })
    .format(date)
    .replace(/\.$/, "")
    .toUpperCase();

  const day = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    timeZone: timezone,
  }).format(date);

  const month = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: timezone,
  })
    .format(date)
    .toUpperCase();

  return `${weekday}, ${day}. ${month}`;
}

function groupByCalendarDay(
  rows: MatchcenterRowViewModel[],
  locale: string,
  timezone: string,
): DayGroup[] {
  const groups = new Map<string, { date: Date; rows: MatchcenterRowViewModel[] }>();

  for (const row of rows) {
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(row.match.startAt);

    if (!groups.has(dayKey)) {
      groups.set(dayKey, { date: row.match.startAt, rows: [] });
    }
    groups.get(dayKey)!.rows.push(row);
  }

  return Array.from(groups.entries()).map(([dayKey, group]) => ({
    dayKey,
    label: formatDayGroupLabel(group.date, locale, timezone),
    rows: group.rows,
  }));
}

// ── Main component ───────────────────────────────────────────────────────────

type MatchcenterWochenplanBulkPanelProps = {
  rows: MatchcenterRowViewModel[];
  locale: string;
  timezone: string;
  canManage: boolean;
  /**
   * Canonical tenant/club logo URL (Tenant.logoUrl).
   * Threaded down to MatchCard and MatchInspector for own-club identity.
   * MATCHCENTER-UX-03-C1.
   */
  tenantLogoUrl?: string | null;
  /**
   * Filter/navigation props threaded from the server component.
   * Used to render the unified Status | Wochenplan | Ansicht control toolbar.
   * MATCHCENTER-UX-03-C2.
   */
  basePath: string;
  tab: MatchcenterTab;
  monthParam: string;
  actionFilter: MatchcenterActionFilter;
  wochenplanFilter: MatchcenterWochenplanFilter;
  teamFilter: string | null;
};

export default function MatchcenterWochenplanBulkPanel({
  rows,
  locale,
  timezone,
  canManage,
  tenantLogoUrl = null,
  basePath,
  tab,
  monthParam,
  actionFilter,
  wochenplanFilter,
  teamFilter,
}: MatchcenterWochenplanBulkPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectorMatchId, setInspectorMatchId] = useState<string | null>(null);
  const [density, setDensity] = useState<MatchCardDensity>("comfortable");

  const dayGroups = groupByCalendarDay(rows, locale, timezone);

  const inspectorMatch: MatchcenterMatchSummary | null = inspectorMatchId
    ? (rows.find((r) => r.match.id === inspectorMatchId)?.match ?? null)
    : null;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(rows.map((r) => r.match.id)));
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  async function applyBulkVisibility(wochenplanVisible: boolean) {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);

    try {
      const res = await fetch("/api/matchcenter/bulk-wochenplan-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: ids, wochenplanVisible }),
      });

      const data = (await res.json().catch(() => null)) as
        | { updated?: number; error?: string }
        | null;

      if (!res.ok) {
        throw new Error(
          data?.error ?? "Wochenplan-Status konnte nicht aktualisiert werden.",
        );
      }

      const count = data?.updated ?? ids.length;
      toast.success(
        `${count} ${count === 1 ? "Spiel" : "Spiele"} ${wochenplanVisible ? "im Wochenplan veröffentlicht" : "aus dem Wochenplan entfernt"}.`,
      );

      exitSelectionMode();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      toast.danger(
        err instanceof Error
          ? err.message
          : "Wochenplan-Status konnte nicht aktualisiert werden.",
        { duration: 6000 },
      );
    }
  }

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount > 0 && selectedCount === rows.length;

  const filterLinkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-xs font-medium transition",
      active
        ? "bg-[var(--foreground)] text-white"
        : "text-[var(--text-2)] hover:text-[var(--foreground)]",
    );

  const densityButtonClass = (active: boolean) =>
    cn(
      "rounded-md px-2.5 py-1 text-xs font-medium transition",
      active
        ? "bg-[var(--foreground)] text-white"
        : "text-[var(--text-2)] hover:text-[var(--foreground)]",
    );

  return (
    <div className="space-y-2">
      {/* ── Unified control toolbar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status group: Alle · Offen · Bereit */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
          role="group"
          aria-label="Status"
        >
          {ACTION_FILTERS.map((item) => {
            const isActive = item.key === actionFilter;
            return (
              <Link
                key={item.key}
                href={buildHref(basePath, {
                  tab,
                  month: monthParam,
                  actionFilter: item.key,
                  wochenplanFilter,
                  teamFilter,
                })}
                data-testid={`matchcenter-filter-${item.key.toLowerCase()}`}
                aria-current={isActive ? "true" : undefined}
                className={filterLinkClass(isActive)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Separator */}
        <span className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />

        {/* Wochenplan group: Alle · Im Wochenplan · Nicht im Wochenplan */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
          role="group"
          aria-label="Wochenplan"
        >
          {WOCHENPLAN_FILTERS.map((item) => {
            const isActive = item.key === wochenplanFilter;
            return (
              <Link
                key={item.key}
                href={buildHref(basePath, {
                  tab,
                  month: monthParam,
                  actionFilter,
                  wochenplanFilter: item.key,
                  teamFilter,
                })}
                data-testid={`matchcenter-wochenplan-filter-${item.key.toLowerCase()}`}
                aria-current={isActive ? "true" : undefined}
                className={filterLinkClass(isActive)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Separator */}
        <span className="h-4 w-px bg-[var(--border)]" aria-hidden="true" />

        {/* Ansicht group: Komfortabel · Kompakt */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5"
          role="group"
          aria-label="Ansicht"
        >
          {(["comfortable", "compact"] as MatchCardDensity[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              aria-pressed={density === d}
              className={densityButtonClass(density === d)}
            >
              {d === "comfortable" ? "Komfortabel" : "Kompakt"}
            </button>
          ))}
        </div>

        {/* Wochenplan management actions */}
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            {isSelecting ? (
              <>
                <button
                  type="button"
                  onClick={allSelected ? clearSelection : selectAll}
                  data-testid="matchcenter-bulk-select-all"
                  className="text-xs font-medium text-[var(--text-2)] underline-offset-2 hover:underline"
                >
                  {allSelected ? "Alle abwählen" : "Alle auswählen"}
                </button>
                <span className="text-xs text-[var(--muted)]">
                  {selectedCount} ausgewählt
                </span>
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  data-testid="matchcenter-bulk-exit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Auswahl beenden
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelecting(true)}
                data-testid="matchcenter-bulk-toggle"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <SquareCheck className="h-3.5 w-3.5" />
                Wochenplan verwalten
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {isSelecting && selectedCount > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          data-testid="matchcenter-bulk-action-bar"
          role="region"
          aria-label="Bulk-Aktionen"
        >
          <span
            className="text-sm font-semibold text-emerald-900"
            data-testid="matchcenter-bulk-count"
          >
            {selectedCount} {selectedCount === 1 ? "Spiel ausgewählt" : "Spiele ausgewählt"}
          </span>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyBulkVisibility(true)}
              disabled={isPending}
              data-testid="matchcenter-bulk-enable"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Im Wochenplan anzeigen
            </button>

            <button
              type="button"
              onClick={() => applyBulkVisibility(false)}
              disabled={isPending}
              data-testid="matchcenter-bulk-disable"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              Aus Wochenplan entfernen
            </button>
          </div>
        </div>
      )}

      {/* ── Match list with matchday grouping ──────────────────────────── */}
      <SectionCard noPadding>
        <div data-testid="matchcenter-spielplanung-list">
          {dayGroups.map((group, groupIdx) => (
            <div key={group.dayKey}>
              <div className={cn("px-5", groupIdx === 0 ? "pt-4" : "pt-2")}>
                <CenterDateGroup
                  label={group.label}
                  count={group.rows.length}
                  countNoun={group.rows.length === 1 ? "Spiel" : "Spiele"}
                />
              </div>
              <div className="divide-y divide-[var(--border)]">
                {group.rows.map((row) => (
                  <MatchCard
                    key={row.match.id}
                    match={row.match}
                    assessment={row.assessment}
                    locale={locale}
                    timezone={timezone}
                    density={density}
                    tenantLogoUrl={tenantLogoUrl}
                    isSelecting={isSelecting}
                    isSelected={selectedIds.has(row.match.id)}
                    onToggleSelect={toggleSelection}
                    onInspect={(id) => setInspectorMatchId(id)}
                  />
                ))}
              </div>
              {groupIdx < dayGroups.length - 1 && (
                <div className="border-t border-[var(--border)]" />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Match Inspector ────────────────────────────────────────────── */}
      <MatchInspector
        match={inspectorMatch}
        locale={locale}
        timezone={timezone}
        tenantLogoUrl={tenantLogoUrl}
        onClose={() => setInspectorMatchId(null)}
      />
    </div>
  );
}
