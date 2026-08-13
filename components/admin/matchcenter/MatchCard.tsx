"use client";

/**
 * MatchCard — MATCHCENTER-UX-03
 *
 * Premium MatchCard that puts club identity and match readiness first.
 *
 * Visual hierarchy:
 *  1. Club logos (dominant, 64px comfortable / 40px compact, no avatar chrome)
 *  2. Teams / VS
 *  3. Date + kickoff
 *  4. Venue
 *  5. Competition / context
 *  6. Home/away indicator
 *  7. Operational readiness (home matches only)
 *
 * HOME matches render a readiness checklist; AWAY matches render a compact
 * away-context strip. Both use the same MatchCard family.
 */

import { MapPin, Radio, Clock3, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { getMatchcenterResultLabel, isMatchLive } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import type { MatchcenterOperationalAssessment } from "@/lib/matchcenter/operational-state";
import { cn } from "@/lib/cn";

// ── Density ──────────────────────────────────────────────────────────────────

export type MatchCardDensity = "comfortable" | "compact";

// ── Date / time formatting ────────────────────────────────────────────────────

function formatMatchKickoff(date: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function formatMatchDay(date: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
  }).format(date);
}

// ── Status labels (non-default states only — MATCHCENTER-UX-03 §11) ──────────

const NON_DEFAULT_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

// ── Operational readiness checklist ─────────────────────────────────────────

type ReadinessChecklistItem = {
  key: string;
  label: string;
  value: string | null;
  ready: boolean;
};

function buildHomeReadinessChecklist(
  match: MatchcenterMatchSummary,
): ReadinessChecklistItem[] {
  return [
    {
      key: "pitch",
      label: "Spielfeld",
      value: match.operational.pitchCode?.trim() || null,
      ready: !!match.operational.pitchCode?.trim(),
    },
    {
      key: "home-dressing",
      label: "Heimkabine",
      value: match.operational.homeDressingRoomCode?.trim() || null,
      ready: !!match.operational.homeDressingRoomCode?.trim(),
    },
    {
      key: "away-dressing",
      label: "Gastkabine",
      value: match.operational.awayDressingRoomCode?.trim() || null,
      ready: !!match.operational.awayDressingRoomCode?.trim(),
    },
    {
      key: "infoboard",
      label: "Infoboard",
      value: match.visibility.infoboardVisible ? "✓" : null,
      ready: match.visibility.infoboardVisible,
    },
  ];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ReadinessChecklist({
  items,
  density,
}: {
  items: ReadinessChecklistItem[];
  density: MatchCardDensity;
}) {
  const readyCount = items.filter((i) => i.ready).length;
  const total = items.length;
  const allReady = readyCount === total;

  return (
    <div
      className={cn(
        "border-t border-[var(--border)] pt-3",
        density === "compact" ? "mt-2" : "mt-3",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          Matchvorbereitung
        </span>
        <span
          className={cn(
            "text-[0.65rem] font-semibold tabular-nums",
            allReady ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {readyCount} / {total} bereit
        </span>
      </div>

      {density === "comfortable" ? (
        <ul className="space-y-1" aria-label="Vorbereitungsstatus">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.ready ? (
                <CheckCircle2
                  className="h-3 w-3 shrink-0 text-emerald-500"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="h-3 w-3 shrink-0 text-amber-500"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "w-20 shrink-0 text-xs",
                  item.ready ? "text-[var(--text-2)]" : "text-[var(--foreground)]",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  item.ready ? "text-[var(--text-2)]" : "text-amber-700",
                )}
              >
                {item.value ?? "fehlt"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        /* Compact: only show missing items */
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {items
            .filter((i) => !i.ready)
            .map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1 text-xs text-amber-700"
              >
                <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                {item.label}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

// ── MatchCard ────────────────────────────────────────────────────────────────

type MatchCardProps = {
  match: MatchcenterMatchSummary;
  assessment: MatchcenterOperationalAssessment;
  locale: string;
  timezone: string;
  density?: MatchCardDensity;
  /** Selection state for Wochenplan bulk management. */
  isSelecting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Inspector open callback — when provided, replaces full-page navigation. */
  onInspect?: (id: string) => void;
};

export function MatchCard({
  match,
  assessment,
  locale,
  timezone,
  density = "comfortable",
  isSelecting = false,
  isSelected = false,
  onToggleSelect,
  onInspect,
}: MatchCardProps) {
  const normalizedHomeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const isHome = normalizedHomeAway === "HOME";
  const isAway = normalizedHomeAway === "AWAY";
  const live = isMatchLive(match);
  const liveScore = getMatchcenterResultLabel(match);

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);

  const logoSize = density === "comfortable" ? "lg" : "md";
  const nonDefaultStatus = NON_DEFAULT_STATUS_LABELS[match.status?.trim().toUpperCase() ?? ""];

  const kickoff = formatMatchKickoff(match.startAt, locale, timezone);
  const day = formatMatchDay(match.startAt, locale, timezone);

  const readinessItems = isHome ? buildHomeReadinessChecklist(match) : [];
  // Full checklist only for READY home matches in comfortable mode.
  // OPEN home matches show the compact missing-item list (not the full checklist)
  // to avoid surfacing ready items as noise and to preserve test semantics.
  const showFullReadiness =
    isHome && assessment.status === "READY" && density === "comfortable";

  function handleClick() {
    if (isSelecting && onToggleSelect) {
      onToggleSelect(match.id);
    } else if (!isSelecting && onInspect) {
      onInspect(match.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <article
      data-testid={`matchcenter-spielplanung-row-${match.id}`}
      className={cn(
        "relative px-5 transition",
        density === "comfortable" ? "py-4" : "py-3",
        isSelecting && isSelected && "bg-emerald-50",
        isSelecting && !isSelected && "hover:bg-[var(--surface-2)]",
        !isSelecting && "hover:bg-[var(--surface-2)]",
        isSelecting ? "cursor-pointer select-none" : "cursor-pointer",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* ── Selection indicator ─────────────────────────────────────────── */}
      {isSelecting && (
        <span
          className={cn(
            "absolute left-3 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded",
            isSelected
              ? "bg-emerald-500 text-white"
              : "border border-[var(--border-strong)] bg-[var(--surface)]",
          )}
          aria-hidden="true"
        >
          {isSelected && (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </span>
      )}

      <div className={cn(isSelecting && "pl-8")}>
        {/* ── Status / context strip ─────────────────────────────────────── */}
        {(nonDefaultStatus || live || match.competitionLabel) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.65rem] font-bold text-white">
                <Radio className="h-2.5 w-2.5" aria-hidden="true" />
                Live
              </span>
            )}
            {live && liveScore && (
              <span
                data-testid={`matchcenter-live-score-${match.id}`}
                className="rounded-md bg-[var(--foreground)] px-2 py-0.5 text-xs font-bold tabular-nums text-white"
              >
                {liveScore}
              </span>
            )}
            {nonDefaultStatus && !live && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                  nonDefaultStatus === "Verschoben" || nonDefaultStatus === "Entwurf"
                    ? "bg-amber-50 text-amber-700"
                    : nonDefaultStatus === "Abgesagt"
                      ? "bg-red-50 text-red-700"
                      : "bg-[var(--surface-2)] text-[var(--text-2)]",
                )}
              >
                {nonDefaultStatus}
              </span>
            )}
            {match.competitionLabel && (
              <span className="text-xs text-[var(--muted)]">
                {match.competitionLabel}
              </span>
            )}
            {normalizedHomeAway && (
              <span
                className={cn(
                  "ml-auto text-[0.65rem] font-semibold uppercase tracking-wide",
                  isHome ? "text-[var(--blue)]" : "text-[var(--muted)]",
                )}
                data-testid={`matchcenter-homeaway-${match.id}`}
              >
                {isHome ? "Heimspiel" : "Auswärtsspiel"}
              </span>
            )}
          </div>
        )}

        {/* ── Club identity row ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          {/* Home side */}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3",
              match.home.isOwnTeam ? "order-1" : "order-1",
            )}
          >
            <ClubLogo
              logoUrl={match.home.externalLogoUrl ?? null}
              name={homeName}
              size={logoSize}
              bare
              className="shrink-0"
            />
            <span
              className={cn(
                "min-w-0 truncate leading-tight",
                density === "comfortable" ? "text-sm" : "text-xs",
                match.home.isOwnTeam
                  ? "font-semibold text-[var(--foreground)]"
                  : "font-normal text-[var(--text-2)]",
              )}
            >
              {homeName}
            </span>
          </div>

          {/* VS / score center */}
          <div className="shrink-0 text-center">
            <span
              className={cn(
                "font-bold tabular-nums",
                density === "comfortable" ? "text-sm" : "text-xs",
                live ? "text-emerald-600" : "text-[var(--muted)]",
              )}
            >
              {live && liveScore ? liveScore : "VS"}
            </span>
          </div>

          {/* Away side */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <span
              className={cn(
                "min-w-0 truncate text-right leading-tight",
                density === "comfortable" ? "text-sm" : "text-xs",
                match.away.isOwnTeam
                  ? "font-semibold text-[var(--foreground)]"
                  : "font-normal text-[var(--text-2)]",
              )}
            >
              {awayName}
            </span>
            <ClubLogo
              logoUrl={match.away.externalLogoUrl ?? null}
              name={awayName}
              size={logoSize}
              bare
              className="shrink-0"
            />
          </div>
        </div>

        {/* ── Match meta ────────────────────────────────────────────────── */}
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]",
          )}
        >
          <time dateTime={match.startAt.toISOString()} className="font-medium text-[var(--text-2)]">
            {day} · {kickoff}
          </time>

          {match.operational.meetingTime && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              Treffpunkt{" "}
              {formatMatchKickoff(match.operational.meetingTime, locale, timezone)}
            </span>
          )}

          {match.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {match.location}
            </span>
          )}
        </div>

        {/* ── Operational action / readiness section ───────────────────── */}
        <div
          data-testid={`matchcenter-action-${match.id}`}
          aria-label="Operativer Status"
        >
          {/* READY home: "Bereit" + full checklist (comfortable) */}
          {isHome && assessment.status === "READY" && (
            <>
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="font-medium">Bereit</span>
              </div>
              {showFullReadiness && (
                <ReadinessChecklist items={readinessItems} density="comfortable" />
              )}
            </>
          )}

          {/* OPEN home: action count + missing item labels */}
          {isHome && assessment.status === "OPEN" && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-amber-700">
                  {assessment.actionCount === 1
                    ? "1 Aufgabe offen"
                    : `${assessment.actionCount} Aufgaben offen`}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-4">
                {assessment.actions.map((action) => (
                  <span key={action.key} className="text-xs text-amber-700">
                    {action.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AWAY match: calm away indicator */}
          {isAway && assessment.status === "AWAY" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Circle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>Auswärtsspiel</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Full-row interaction target ───────────────────────────────────── */}
      {!isSelecting && onInspect && (
        <button
          type="button"
          aria-label={`${homeName} vs ${awayName} – Details anzeigen`}
          className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-inset"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onInspect(match.id);
          }}
        />
      )}
    </article>
  );
}
