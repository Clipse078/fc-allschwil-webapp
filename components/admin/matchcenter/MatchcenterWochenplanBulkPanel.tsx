"use client";

/**
 * PUB-WEEKPLAN-VISIBILITY-01 — MatchCenter Wochenplan Bulk Panel
 *
 * Client component that wraps the Spielplanung list with:
 *   - Per-match Wochenplan publication indicator
 *   - Multi-select mode toggle ("Wochenplan verwalten")
 *   - Checkbox selection per match row
 *   - Contextual bulk action bar (Im Wochenplan / Aus Wochenplan)
 *   - Optimistic UI update after mutation
 *
 * Uses POST /api/matchcenter/bulk-wochenplan-visibility.
 * Falls back gracefully when canManage=false (read-only view).
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Radio,
  SquareCheck,
  SquareMinus,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/page/SectionCard";
import MatchTeamLogo from "./MatchTeamLogo";
import { getMatchcenterResultLabel, isMatchLive } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import type { MatchcenterRowViewModel } from "@/lib/matchcenter/view-model";
import { cn } from "@/lib/cn";

// ── Status display maps (mirrored from MatchcenterSpielplanungRow) ──────────

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, "info" | "success" | "warning" | "danger" | "outline"> = {
  SCHEDULED: "info",
  LIVE: "success",
  POSTPONED: "warning",
  CANCELED: "danger",
  CANCELLED: "danger",
  DRAFT: "outline",
  ARCHIVED: "outline",
};

function formatMatchDate(value: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

// ── Wochenplan publication badge ────────────────────────────────────────────

function WochenplanBadge({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700"
        data-testid="wochenplan-badge-visible"
        title="Im Wochenplan"
      >
        <Eye className="h-2.5 w-2.5" aria-hidden="true" />
        Im Wochenplan
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--muted)]"
      data-testid="wochenplan-badge-hidden"
      title="Nicht im Wochenplan"
    >
      <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />
      Nicht im Wochenplan
    </span>
  );
}

// ── Per-row component ───────────────────────────────────────────────────────

type BulkRowProps = {
  match: MatchcenterMatchSummary;
  assessment: MatchcenterRowViewModel["assessment"];
  locale: string;
  timezone: string;
  isSelecting: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
};

function BulkRow({
  match,
  assessment,
  locale,
  timezone,
  isSelecting,
  isSelected,
  onToggle,
}: BulkRowProps) {
  const normalizedHomeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const homeAwayLabel =
    normalizedHomeAway === "HOME"
      ? "Heimspiel"
      : normalizedHomeAway === "AWAY"
        ? "Auswärtsspiel"
        : null;

  const statusLabel = STATUS_LABELS[match.status] ?? match.status;
  const statusVariant = STATUS_VARIANTS[match.status] ?? "info";
  const live = isMatchLive(match);
  const liveScore = getMatchcenterResultLabel(match);

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);

  return (
    <article
      data-testid={`matchcenter-spielplanung-row-${match.id}`}
      className={cn(
        "relative grid gap-3 px-5 py-4 transition",
        isSelecting ? "cursor-pointer select-none" : "hover:bg-[var(--surface-2)]",
        isSelecting && isSelected && "bg-emerald-50 hover:bg-emerald-50",
        isSelecting && !isSelected && "hover:bg-[var(--surface-2)]",
      )}
      onClick={isSelecting ? () => onToggle(match.id) : undefined}
    >
      {/* Selection checkbox (only in selection mode) */}
      {isSelecting && (
        <div
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(match.id);
          }}
        >
          {isSelected ? (
            <SquareCheck
              className="h-5 w-5 text-emerald-600"
              aria-label={`${match.title} abgewählt`}
              data-testid={`matchcenter-bulk-checkbox-${match.id}`}
            />
          ) : (
            <SquareMinus
              className="h-5 w-5 text-[var(--border-strong)]"
              aria-label={`${match.title} auswählen`}
              data-testid={`matchcenter-bulk-checkbox-${match.id}`}
            />
          )}
        </div>
      )}

      <div
        className={cn(
          "min-w-0 lg:col-span-1",
          isSelecting && "pl-8",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant} size="sm">
            {live ? <Radio className="h-3 w-3" /> : null}
            {statusLabel}
          </Badge>

          {homeAwayLabel ? (
            <Badge
              variant={normalizedHomeAway === "HOME" ? "success" : "default"}
              size="sm"
              data-testid={`matchcenter-homeaway-${match.id}`}
            >
              {homeAwayLabel}
            </Badge>
          ) : null}

          {match.competitionLabel ? (
            <span className="text-xs font-medium text-[var(--muted)]">
              {match.competitionLabel}
            </span>
          ) : null}

          {live && liveScore ? (
            <span
              data-testid={`matchcenter-live-score-${match.id}`}
              className="rounded-md bg-[var(--foreground)] px-2 py-0.5 text-xs font-bold tabular-nums text-white"
            >
              {liveScore}
            </span>
          ) : null}

          {/* Wochenplan publication indicator */}
          <WochenplanBadge visible={match.visibility.wochenplanVisible} />
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <MatchTeamLogo
            label={homeName}
            emphasized={match.home.isOwnTeam}
            logoUrl={match.home.externalLogoUrl}
          />
          <p
            className={
              match.home.isOwnTeam
                ? "min-w-0 truncate text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-sm text-[var(--foreground)]"
            }
          >
            {homeName}
          </p>

          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            vs
          </span>

          <MatchTeamLogo
            label={awayName}
            emphasized={match.away.isOwnTeam}
            logoUrl={match.away.externalLogoUrl}
          />
          <p
            className={
              match.away.isOwnTeam
                ? "min-w-0 truncate text-sm font-semibold text-[var(--foreground)]"
                : "min-w-0 truncate text-sm text-[var(--foreground)]"
            }
          >
            {awayName}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatMatchDate(match.startAt, locale, timezone)}
          </span>

          {match.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {match.location}
            </span>
          ) : null}

          {match.operational.meetingTime ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Treffpunkt{" "}
              {new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: timezone,
              }).format(match.operational.meetingTime)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end"
        data-testid={`matchcenter-action-${match.id}`}
      >
        {assessment.status === "READY" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bereit
          </span>
        ) : assessment.status === "AWAY" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Auswärtsspiel
          </span>
        ) : assessment.status === "OPEN" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <CircleAlert className="h-3.5 w-3.5" />
              {assessment.actionCount === 1
                ? "1 Aufgabe offen"
                : `${assessment.actionCount} Aufgaben offen`}
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              {assessment.actions.map((action) => (
                <Badge key={action.key} variant="warning" size="sm">
                  {action.label}
                </Badge>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Full-row nav link — only active when NOT in selection mode */}
      {!isSelecting && (
        <a
          href={`/dashboard/matchcenter/${match.id}`}
          aria-label={`Details zu ${match.title} anzeigen`}
          className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
        >
          <span className="sr-only">Details zu {match.title} anzeigen</span>
        </a>
      )}
    </article>
  );
}

// ── Main bulk panel ─────────────────────────────────────────────────────────

type MatchcenterWochenplanBulkPanelProps = {
  rows: MatchcenterRowViewModel[];
  locale: string;
  timezone: string;
  canManage: boolean;
};

export default function MatchcenterWochenplanBulkPanel({
  rows,
  locale,
  timezone,
  canManage,
}: MatchcenterWochenplanBulkPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    const label = wochenplanVisible ? "Im Wochenplan" : "Aus Wochenplan";

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

  return (
    <div className="space-y-3">
      {/* Wochenplan management toolbar ──────────────────────────────────────── */}
      {canManage && (
        <div className="flex items-center gap-2">
          {!isSelecting ? (
            <button
              type="button"
              onClick={() => setIsSelecting(true)}
              data-testid="matchcenter-bulk-toggle"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <SquareCheck className="h-3.5 w-3.5" />
              Wochenplan verwalten
            </button>
          ) : (
            <button
              type="button"
              onClick={exitSelectionMode}
              data-testid="matchcenter-bulk-exit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              <X className="h-3.5 w-3.5" />
              Auswahl beenden
            </button>
          )}

          {isSelecting && (
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
            </>
          )}
        </div>
      )}

      {/* Bulk action bar ─────────────────────────────────────────────────────── */}
      {isSelecting && selectedCount > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          data-testid="matchcenter-bulk-action-bar"
          role="region"
          aria-label="Bulk-Aktionen"
        >
          <span className="text-sm font-semibold text-emerald-900" data-testid="matchcenter-bulk-count">
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

      {/* Match list ──────────────────────────────────────────────────────────── */}
      <SectionCard noPadding>
        <div
          className="divide-y divide-[var(--border)]"
          data-testid="matchcenter-spielplanung-list"
        >
          {rows.map((row) => (
            <BulkRow
              key={row.match.id}
              match={row.match}
              assessment={row.assessment}
              locale={locale}
              timezone={timezone}
              isSelecting={isSelecting}
              isSelected={selectedIds.has(row.match.id)}
              onToggle={toggleSelection}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
