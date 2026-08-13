"use client";

/**
 * MatchCard — MATCHCENTER-UX-03-C2
 *
 * Premium MatchCard with deliberate two-region composition.
 *
 * COMFORTABLE — MATCH IDENTITY | OPERATIONS (~70 / ~30 split):
 * ┌──────────────────────────────────────────────┬──────────────────────────┐
 * │  competition                    HEIMSPIEL    │  MATCHVORBEREITUNG       │
 * │                                              │                          │
 * │  [LOGO] Team       VS      Team [LOGO]       │  ✓ Bereit / N offen      │
 * │                                              │  ✓ Spielfeld   KR2 A     │
 * │  So, 02.08. · 14:00 · Im Brüel, Allschwil   │  ✓ Heimkabine  4         │
 * │                                              │  ⚠ Gastkabine  fehlt     │
 * └──────────────────────────────────────────────┴──────────────────────────┘
 *
 * COMPACT: [LOGO] Team · VS · Team [LOGO] — one-line readiness summary.
 *
 * Own-club identity (C1, preserved):
 *   internal team (isOwnTeam) → Tenant.logoUrl via tenantLogoUrl prop
 *   external opponent         → ExternalTeam/ExternalClub logo
 *   any                       → generic shield fallback
 *
 * No hardcoded club names. Works for every tenant.
 */

import { MapPin, Radio, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { getMatchcenterResultLabel, isMatchLive } from "@/lib/matchcenter/match-lifecycle";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import type { MatchcenterOperationalAssessment } from "@/lib/matchcenter/operational-state";
import { cn } from "@/lib/cn";

// ── Density ───────────────────────────────────────────────────────────────────

export type MatchCardDensity = "comfortable" | "compact";

// ── Date/time formatting ──────────────────────────────────────────────────────

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

// ── Non-default status labels ─────────────────────────────────────────────────

const NON_DEFAULT_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

// ── Readiness item type ───────────────────────────────────────────────────────

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

// ── ReadinessRail — right-side operations column (comfortable mode) ───────────

function ReadinessRail({
  items,
  assessment,
}: {
  items: ReadinessChecklistItem[];
  assessment: MatchcenterOperationalAssessment;
}) {
  const allReady = assessment.status === "READY";

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
          Matchvorbereitung
        </span>
        <span
          className={cn(
            "text-[0.65rem] font-semibold tabular-nums",
            allReady ? "text-emerald-600" : "text-amber-600",
          )}
        >
          {allReady
            ? "Bereit"
            : assessment.actionCount === 1
              ? "1 Aufgabe offen"
              : `${assessment.actionCount} Aufgaben offen`}
        </span>
      </div>

      {/* Checklist */}
      {allReady ? (
        // READY: show all items with their values
        <ul className="space-y-1.5" aria-label="Vorbereitungsstatus">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5">
              <CheckCircle2
                className="h-3 w-3 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
              <span className="w-16 shrink-0 text-xs text-[var(--text-2)]">
                {item.label}
              </span>
              <span className="truncate text-xs font-medium text-[var(--text-2)]">
                {item.value ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // OPEN: show only missing/problematic actions (keeps actionable focus)
        <ul className="space-y-1.5" aria-label="Fehlende Aufgaben">
          {assessment.actions.map((action) => (
            <li key={action.key} className="flex items-center gap-1.5">
              <AlertTriangle
                className="h-3 w-3 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <span className="truncate text-xs text-amber-700">{action.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── AwayOpsInfo — right-side column for away matches ─────────────────────────

function AwayOpsInfo({ venue }: { venue: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
        Auswärtsspiel
      </span>
      {venue && (
        <p className="text-xs text-[var(--text-2)]">{venue}</p>
      )}
    </div>
  );
}

// ── CompactReadiness — one-line readiness for compact mode ────────────────────

function CompactReadiness({
  assessment,
}: {
  assessment: MatchcenterOperationalAssessment;
}) {
  if (assessment.status === "AWAY" || assessment.status === "NOT_APPLICABLE") {
    return null;
  }

  const allReady = assessment.status === "READY";
  const missing = assessment.actions;

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
        {missing.length === 1
          ? "1 Aufgabe offen"
          : `${missing.length} Aufgaben offen`}
      </span>
      {missing.slice(0, 2).map((action) => (
        <span key={action.key} className="text-amber-600">
          · {action.label}
        </span>
      ))}
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────

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

  const nonDefaultStatus =
    NON_DEFAULT_STATUS_LABELS[match.status?.trim().toUpperCase() ?? ""];
  const kickoff = formatMatchKickoff(match.startAt, locale, timezone);
  const day = formatMatchDay(match.startAt, locale, timezone);

  const readinessItems = isHome ? buildHomeReadinessChecklist(match) : [];

  // Whether to show the operations column
  const hasOpsColumn = isHome || isAway;

  const isComfortable = density === "comfortable";

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
        "relative transition hover:bg-[var(--surface-2)] cursor-pointer",
        isComfortable ? "px-5 py-5" : "px-4 py-3",
        isSelecting && isSelected && "bg-emerald-50",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Selection checkbox */}
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

      {isComfortable ? (
        /* ── COMFORTABLE: two-region layout ── */
        <div
          className={cn(
            "grid",
            hasOpsColumn
              ? "grid-cols-[minmax(0,1fr)_210px]"
              : "grid-cols-1",
            isSelecting && "pl-8",
          )}
        >
          {/* MATCH IDENTITY region */}
          <div className={cn("min-w-0", hasOpsColumn && "pr-5")}>
            {/* Context strip: status tags + competition + home/away badge */}
            {(match.competitionLabel ||
              normalizedHomeAway ||
              nonDefaultStatus ||
              live) && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
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
                {/* Non-default status */}
                {nonDefaultStatus && !live && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6rem] font-semibold",
                      nonDefaultStatus === "Verschoben" ||
                        nonDefaultStatus === "Entwurf"
                        ? "bg-amber-50 text-amber-700"
                        : nonDefaultStatus === "Abgesagt"
                          ? "bg-red-50 text-red-700"
                          : "bg-[var(--surface-2)] text-[var(--text-2)]",
                    )}
                  >
                    {nonDefaultStatus}
                  </span>
                )}
                {/* Competition — plain metadata */}
                {match.competitionLabel && (
                  <span className="text-xs text-[var(--muted)]">
                    {match.competitionLabel}
                  </span>
                )}
                {/* Home/away badge — right edge of identity region */}
                {normalizedHomeAway && (
                  <span
                    className={cn(
                      "ml-auto text-[0.6rem] font-bold uppercase tracking-wide",
                      isHome ? "text-[var(--blue)]" : "text-[var(--muted)]",
                    )}
                    data-testid={`matchcenter-homeaway-${match.id}`}
                  >
                    {isHome ? "Heimspiel" : "Auswärtsspiel"}
                  </span>
                )}
              </div>
            )}

            {/* Dominant matchup — centered bounded area */}
            <div className="flex items-center justify-center gap-x-2 py-1">
              {/* Home identity unit: [LOGO] Name */}
              <div className="flex min-w-0 max-w-[42%] shrink items-center gap-2.5">
                <ClubLogo
                  logoUrl={homeLogoUrl}
                  name={homeName}
                  size="lg"
                  bare
                  className="shrink-0"
                />
                <span
                  className={cn(
                    "min-w-0 truncate leading-tight",
                    match.home.isOwnTeam
                      ? "text-base font-bold text-[var(--foreground)]"
                      : "text-base font-semibold text-[var(--text-2)]",
                  )}
                >
                  {homeName}
                </span>
              </div>

              {/* VS / live score center */}
              <div className="shrink-0 px-3 text-center">
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    live ? "text-emerald-600" : "text-[var(--muted)]",
                  )}
                >
                  {live && liveScore ? liveScore : "VS"}
                </span>
              </div>

              {/* Away identity unit: Name [LOGO] (reversed) */}
              <div className="flex min-w-0 max-w-[42%] shrink flex-row-reverse items-center gap-2.5">
                <ClubLogo
                  logoUrl={awayLogoUrl}
                  name={awayName}
                  size="lg"
                  bare
                  className="shrink-0"
                />
                <span
                  className={cn(
                    "min-w-0 truncate text-right leading-tight",
                    match.away.isOwnTeam
                      ? "text-base font-bold text-[var(--foreground)]"
                      : "text-base font-semibold text-[var(--text-2)]",
                  )}
                >
                  {awayName}
                </span>
              </div>
            </div>

            {/* Match metadata: date · kickoff · venue */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
              <time
                dateTime={match.startAt.toISOString()}
                className="font-medium text-[var(--text-2)]"
              >
                {day} · {kickoff}
              </time>

              {match.operational.meetingTime && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  Treffpunkt{" "}
                  {formatMatchKickoff(
                    match.operational.meetingTime,
                    locale,
                    timezone,
                  )}
                </span>
              )}

              {match.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {match.location}
                </span>
              )}
            </div>
          </div>

          {/* OPERATIONS region */}
          {hasOpsColumn && (
            <div
              className="border-l border-[var(--border)] pl-4 pt-0.5"
              data-testid={`matchcenter-action-${match.id}`}
              aria-label="Operativer Status"
            >
              {isHome && (
                <ReadinessRail
                  items={readinessItems}
                  assessment={assessment}
                />
              )}
              {isAway && (
                <AwayOpsInfo venue={match.location} />
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── COMPACT: single-row condensed layout ── */
        <div className={cn("flex flex-col gap-1.5", isSelecting && "pl-8")}>
          {/* Compact matchup row */}
          <div className="flex items-center gap-2">
            {/* Home identity unit */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ClubLogo
                logoUrl={homeLogoUrl}
                name={homeName}
                size="md"
                bare
                className="shrink-0"
              />
              <span
                className={cn(
                  "min-w-0 truncate text-sm leading-tight",
                  match.home.isOwnTeam
                    ? "font-semibold text-[var(--foreground)]"
                    : "font-normal text-[var(--text-2)]",
                )}
              >
                {homeName}
              </span>
            </div>

            {/* VS / score center */}
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                live ? "text-emerald-600" : "text-[var(--muted)]",
              )}
            >
              {live && liveScore ? liveScore : "VS"}
            </span>

            {/* Away identity unit */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span
                className={cn(
                  "min-w-0 truncate text-right text-sm leading-tight",
                  match.away.isOwnTeam
                    ? "font-semibold text-[var(--foreground)]"
                    : "font-normal text-[var(--text-2)]",
                )}
              >
                {awayName}
              </span>
              <ClubLogo
                logoUrl={awayLogoUrl}
                name={awayName}
                size="md"
                bare
                className="shrink-0"
              />
            </div>
          </div>

          {/* Compact metadata + readiness */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
              <time
                dateTime={match.startAt.toISOString()}
                className="font-medium text-[var(--text-2)]"
              >
                {day} · {kickoff}
              </time>
              {match.location && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                  {match.location}
                </span>
              )}
              {normalizedHomeAway && (
                <span
                  className={cn(
                    "text-[0.6rem] font-bold uppercase tracking-wide",
                    isHome ? "text-[var(--blue)]" : "text-[var(--muted)]",
                  )}
                  data-testid={`matchcenter-homeaway-${match.id}`}
                >
                  {isHome ? "H" : "A"}
                </span>
              )}
            </div>

            <div
              data-testid={`matchcenter-action-${match.id}`}
              aria-label="Operativer Status"
            >
              <CompactReadiness assessment={assessment} />
            </div>
          </div>
        </div>
      )}

      {/* Full-row focus/click target */}
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
