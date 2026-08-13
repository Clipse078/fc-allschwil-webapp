"use client";

/**
 * MatchCard — MATCHCENTER-UX-03-C1
 *
 * Premium MatchCard. Visual hierarchy:
 *
 *  COMFORTABLE
 *  ┌──────────────────────────────────────────┬──────────────────┐
 *  │  context line (competition · home/away)  │  HEIMSPIEL badge │
 *  │                                          │                  │
 *  │  [LOGO] Team/Club   VS   Team/Club [LOGO]│                  │
 *  │                                          │                  │
 *  │  date · kickoff · venue                  │                  │
 *  ├──────────────────────────────────────────┼──────────────────┤
 *  │  Matchvorbereitung                       │  2 / 3 bereit    │
 *  │  ✓ Spielfeld  KR2 A                      │                  │
 *  │  ⚠ Gastkabine fehlt                      │                  │
 *  └──────────────────────────────────────────┴──────────────────┘
 *
 *  COMPACT: logo + name | VS | name + logo  — no full checklist
 *
 * Own-club identity:
 *   internal team → tenant/club logo (Tenant.logoUrl via tenantLogoUrl prop)
 *   external team → ExternalTeam/ExternalClub logo
 *   any → generic shield fallback when no logo is configured
 */

import { MapPin, Radio, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
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

// ── Status labels (MATCHCENTER-UX-03-C1 §17 — non-default only) ─────────────

const NON_DEFAULT_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

// ── Operational readiness ────────────────────────────────────────────────────

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

// ── ReadinessBlock — semantic, compact ──────────────────────────────────────

function ReadinessBlock({
  items,
  density,
}: {
  items: ReadinessChecklistItem[];
  density: MatchCardDensity;
}) {
  const readyCount = items.filter((i) => i.ready).length;
  const total = items.length;
  const allReady = readyCount === total;
  const missing = items.filter((i) => !i.ready);

  if (density === "compact") {
    if (allReady) {
      return (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="font-medium">Bereit</span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs text-amber-700">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="font-medium">
          {missing.length === 1 ? "1 Aufgabe offen" : `${missing.length} Aufgaben offen`}
        </span>
        {missing.slice(0, 2).map((item) => (
          <span key={item.key} className="text-amber-600">
            · {item.label}
          </span>
        ))}
      </div>
    );
  }

  // Comfortable — full checklist
  return (
    <div>
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
          {allReady ? "Bereit" : `${readyCount} / ${total} bereit`}
        </span>
      </div>
      <ul className="space-y-1" aria-label="Vorbereitungsstatus">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            {item.ready ? (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
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
  /**
   * Canonical tenant/club logo URL (Tenant.logoUrl).
   * Used for all internal (isOwnTeam) sides — MATCHCENTER-UX-03-C1.
   */
  tenantLogoUrl?: string | null;
  isSelecting?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onInspect?: (id: string) => void;
};

export function MatchCard({
  match,
  assessment,
  locale,
  timezone,
  density = "comfortable",
  tenantLogoUrl = null,
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

  // Canonical logo resolution: own team → tenant logo; external → club-directory logo
  const homeLogoUrl = resolveClubIdentityLogoUrl(match.home, tenantLogoUrl);
  const awayLogoUrl = resolveClubIdentityLogoUrl(match.away, tenantLogoUrl);

  const logoSize = density === "comfortable" ? "lg" : "md";
  const nonDefaultStatus = NON_DEFAULT_STATUS_LABELS[match.status?.trim().toUpperCase() ?? ""];

  const kickoff = formatMatchKickoff(match.startAt, locale, timezone);
  const day = formatMatchDay(match.startAt, locale, timezone);

  const readinessItems = isHome ? buildHomeReadinessChecklist(match) : [];

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

  const isComfortable = density === "comfortable";

  return (
    <article
      data-testid={`matchcenter-spielplanung-row-${match.id}`}
      className={cn(
        "relative transition",
        isComfortable ? "px-5 py-4" : "px-4 py-3",
        isSelecting && isSelected && "bg-emerald-50",
        "hover:bg-[var(--surface-2)] cursor-pointer",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={cn(isSelecting && "pl-8")}>

        {/* ── Selection checkbox ─────────────────────────────────────── */}
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
            {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
          </span>
        )}

        {/* ── Context strip: competition + home/away tag ──────────── */}
        {(match.competitionLabel || normalizedHomeAway || nonDefaultStatus || live) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {/* Live indicator */}
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                <Radio className="h-2.5 w-2.5" aria-hidden="true" />
                Live
              </span>
            )}
            {/* Live score */}
            {live && liveScore && (
              <span
                data-testid={`matchcenter-live-score-${match.id}`}
                className="rounded-md bg-[var(--foreground)] px-2 py-0.5 text-xs font-bold tabular-nums text-white"
              >
                {liveScore}
              </span>
            )}
            {/* Semantic status (non-default only — §17) */}
            {nonDefaultStatus && !live && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
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
            {/* Competition — plain metadata, no pill (§17) */}
            {match.competitionLabel && (
              <span className="text-xs text-[var(--muted)]">
                {match.competitionLabel}
              </span>
            )}
            {/* Home/away — right-aligned semantic badge */}
            {normalizedHomeAway && (
              <span
                className={cn(
                  "ml-auto text-[0.6rem] font-bold uppercase tracking-wide",
                  isHome
                    ? "text-[var(--blue)]"
                    : "text-[var(--muted)]",
                )}
                data-testid={`matchcenter-homeaway-${match.id}`}
              >
                {isHome ? "Heimspiel" : "Auswärtsspiel"}
              </span>
            )}
          </div>
        )}

        {/* ── Dominant club identity: LOGO  TEAM  VS  TEAM  LOGO ─── */}
        <div className="flex items-center gap-3">
          {/* Home side */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ClubLogo
              logoUrl={homeLogoUrl}
              name={homeName}
              size={logoSize}
              bare
              className="shrink-0"
            />
            <div className="min-w-0">
              <span
                className={cn(
                  "block min-w-0 truncate leading-tight",
                  isComfortable
                    ? match.home.isOwnTeam
                      ? "text-base font-bold text-[var(--foreground)]"
                      : "text-base font-medium text-[var(--text-2)]"
                    : match.home.isOwnTeam
                      ? "text-sm font-semibold text-[var(--foreground)]"
                      : "text-sm font-normal text-[var(--text-2)]",
                )}
              >
                {homeName}
              </span>
            </div>
          </div>

          {/* VS / score center */}
          <div className="shrink-0 text-center">
            <span
              className={cn(
                "font-bold tabular-nums",
                isComfortable ? "text-sm" : "text-xs",
                live ? "text-emerald-600" : "text-[var(--muted)]",
              )}
            >
              {live && liveScore ? liveScore : "VS"}
            </span>
          </div>

          {/* Away side */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="min-w-0">
              <span
                className={cn(
                  "block min-w-0 truncate text-right leading-tight",
                  isComfortable
                    ? match.away.isOwnTeam
                      ? "text-base font-bold text-[var(--foreground)]"
                      : "text-base font-medium text-[var(--text-2)]"
                    : match.away.isOwnTeam
                      ? "text-sm font-semibold text-[var(--foreground)]"
                      : "text-sm font-normal text-[var(--text-2)]",
                )}
              >
                {awayName}
              </span>
            </div>
            <ClubLogo
              logoUrl={awayLogoUrl}
              name={awayName}
              size={logoSize}
              bare
              className="shrink-0"
            />
          </div>
        </div>

        {/* ── Match meta: date · kickoff · venue ────────────────────── */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]",
            isComfortable ? "mt-2" : "mt-1.5",
          )}
        >
          <time dateTime={match.startAt.toISOString()} className="font-medium text-[var(--text-2)]">
            {day} · {kickoff}
          </time>

          {match.operational.meetingTime && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              Treffpunkt {formatMatchKickoff(match.operational.meetingTime, locale, timezone)}
            </span>
          )}

          {match.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {match.location}
            </span>
          )}
        </div>

        {/* ── Operational state ─────────────────────────────────────── */}
        <div
          data-testid={`matchcenter-action-${match.id}`}
          aria-label="Operativer Status"
        >
          {/* HOME – READY */}
          {isHome && assessment.status === "READY" && (
            <div
              className={cn(
                "border-t border-[var(--border)]",
                isComfortable ? "mt-3 pt-3" : "mt-2 pt-2",
              )}
            >
              {isComfortable ? (
                <ReadinessBlock items={readinessItems} density={density} />
              ) : (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="font-medium">Bereit</span>
                </div>
              )}
            </div>
          )}

          {/* HOME – OPEN */}
          {isHome && assessment.status === "OPEN" && (
            <div
              className={cn(
                "border-t border-[var(--border)]",
                isComfortable ? "mt-3 pt-3" : "mt-2 pt-2",
              )}
            >
              {isComfortable ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                      Matchvorbereitung
                    </span>
                    <span className="text-[0.65rem] font-semibold tabular-nums text-amber-600">
                      {assessment.actionCount === 1
                        ? "1 Aufgabe offen"
                        : `${assessment.actionCount} Aufgaben offen`}
                    </span>
                  </div>
                  <ul className="space-y-1" aria-label="Fehlende Aufgaben">
                    {assessment.actions.map((action) => (
                      <li key={action.key} className="flex items-center gap-2">
                        <AlertTriangle
                          className="h-3 w-3 shrink-0 text-amber-500"
                          aria-hidden="true"
                        />
                        <span className="text-xs text-amber-700">{action.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="font-medium">
                    {assessment.actionCount === 1
                      ? "1 Aufgabe offen"
                      : `${assessment.actionCount} Aufgaben offen`}
                  </span>
                  {assessment.actions.slice(0, 2).map((action) => (
                    <span key={action.key} className="text-amber-600">
                      · {action.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AWAY */}
          {isAway && assessment.status === "AWAY" && isComfortable && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Auswärtsspiel — keine Heimressourcen erforderlich.
            </div>
          )}
        </div>
      </div>

      {/* ── Full-row focus/click target ───────────────────────────────── */}
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
