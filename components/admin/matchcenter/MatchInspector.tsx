"use client";

/**
 * MatchInspector — MATCHCENTER-UX-03-C1
 *
 * Context-preserving right-side inspector panel for match detail review.
 * Uses the existing SCE Sheet primitive.
 *
 * Visual top section:
 *   [OWN-CLUB LOGO]     VS / result     [OPPONENT LOGO]
 *   Team name                           Team name
 *   Date · kickoff
 *   Venue
 *
 * Own-club identity: resolveClubIdentityLogoUrl() — same canonical rule as
 * MatchCard. Internal teams show the tenant/club logo; external opponents show
 * the Club Directory logo.
 *
 * Note: hardcoded "FCA-Ressourcen" reference removed — §15 generic away note.
 */

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  AlertTriangle,
  MapPin,
  Clock3,
  Eye,
  EyeOff,
  Radio,
} from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { getMatchcenterResultLabel, isMatchLive } from "@/lib/matchcenter/match-lifecycle";
import { assessMatchOperationalState } from "@/lib/matchcenter/operational-state";
import type { MatchcenterMatchSummary } from "@/lib/matchcenter/types";
import { cn } from "@/lib/cn";

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatDateTime(date: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function formatTime(date: Date, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

// ── ReadinessRow ─────────────────────────────────────────────────────────────

function ReadinessRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string | null;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {ready ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <span className="w-28 shrink-0 text-sm text-[var(--text-2)]">{label}</span>
      <span
        className={cn(
          "truncate text-sm font-medium",
          ready ? "text-[var(--foreground)]" : "text-amber-700",
        )}
      >
        {value ?? "fehlt"}
      </span>
    </div>
  );
}

// ── MatchInspector ───────────────────────────────────────────────────────────

type MatchInspectorProps = {
  match: MatchcenterMatchSummary | null;
  locale: string;
  timezone: string;
  /**
   * Canonical tenant/club logo URL (Tenant.logoUrl).
   * Passed from the page server component via MatchcenterWochenplanBulkPanel.
   */
  tenantLogoUrl?: string | null;
  onClose: () => void;
};

export function MatchInspector({
  match,
  locale,
  timezone,
  tenantLogoUrl = null,
  onClose,
}: MatchInspectorProps) {
  if (!match) return null;

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);
  const normalizedHomeAway = match.homeAway?.trim().toUpperCase() ?? null;
  const isHome = normalizedHomeAway === "HOME";
  const isAway = normalizedHomeAway === "AWAY";
  const live = isMatchLive(match);
  const result = getMatchcenterResultLabel(match);
  const assessment = assessMatchOperationalState(match);

  // Canonical logo resolution — same rule as MatchCard
  const homeLogoUrl = resolveClubIdentityLogoUrl(match.home, tenantLogoUrl);
  const awayLogoUrl = resolveClubIdentityLogoUrl(match.away, tenantLogoUrl);

  const dateStr = formatDateTime(match.startAt, locale, timezone);
  const meetingTimeStr = match.operational.meetingTime
    ? formatTime(match.operational.meetingTime, locale, timezone)
    : null;

  const title = `${homeName} vs ${awayName}`;

  const homeReadiness = isHome
    ? [
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
          value: match.visibility.infoboardVisible ? "Sichtbar" : null,
          ready: match.visibility.infoboardVisible,
        },
      ]
    : [];

  const readyCount = homeReadiness.filter((i) => i.ready).length;
  const totalReadiness = homeReadiness.length;

  const footer = (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-[var(--text-2)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:underline"
      >
        Schließen
      </button>
      <Link
        href={`/dashboard/matchcenter/${match.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sce-primary)] bg-[var(--sce-primary)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2"
      >
        Match bearbeiten
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={match.competitionLabel ?? undefined}
      footer={footer}
    >
      <div className="space-y-6">
        {/* ── Club identity — dominant, bare logos, 80px ──────────────────── */}
        <div className="flex items-center justify-around gap-4 pt-2">
          {/* Home identity */}
          <div className="flex flex-1 flex-col items-center gap-3 text-center">
            <ClubLogo
              logoUrl={homeLogoUrl}
              name={homeName}
              size="xl"
              bare
            />
            <span
              className={cn(
                "text-sm leading-snug",
                match.home.isOwnTeam
                  ? "font-semibold text-[var(--foreground)]"
                  : "text-[var(--text-2)]",
              )}
            >
              {homeName}
            </span>
          </div>

          {/* VS / score */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                <Radio className="h-2.5 w-2.5" aria-hidden="true" />
                Live
              </span>
            )}
            <span
              className={cn(
                "text-2xl font-bold",
                result ? "text-[var(--foreground)]" : "text-[var(--muted)]",
              )}
            >
              {result ?? "VS"}
            </span>
          </div>

          {/* Away identity */}
          <div className="flex flex-1 flex-col items-center gap-3 text-center">
            <ClubLogo
              logoUrl={awayLogoUrl}
              name={awayName}
              size="xl"
              bare
            />
            <span
              className={cn(
                "text-sm leading-snug",
                match.away.isOwnTeam
                  ? "font-semibold text-[var(--foreground)]"
                  : "text-[var(--text-2)]",
              )}
            >
              {awayName}
            </span>
          </div>
        </div>

        {/* ── Match details ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Spielinformationen
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <span className="text-[var(--foreground)]">{dateStr}</span>
            </div>

            {meetingTimeStr && (
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                <span className="text-[var(--text-2)]">
                  Treffpunkt {meetingTimeStr}
                </span>
              </div>
            )}

            {match.location && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                <span className="text-[var(--foreground)]">{match.location}</span>
              </div>
            )}

            {normalizedHomeAway && (
              <div className="flex items-center gap-2">
                <Circle
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isHome ? "text-[var(--blue)]" : "text-[var(--muted)]",
                  )}
                  aria-hidden="true"
                />
                <span className={cn("font-medium", isHome ? "text-[var(--blue)]" : "text-[var(--text-2)]")}>
                  {isHome ? "Heimspiel" : "Auswärtsspiel"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Wochenplan ────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Wochenplan
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {match.visibility.wochenplanVisible ? (
              <>
                <Eye className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <span className="font-medium text-emerald-700">Im Wochenplan veröffentlicht</span>
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                <span className="text-[var(--text-2)]">Nicht im Wochenplan</span>
              </>
            )}
          </div>
        </div>

        {/* ── Operational readiness (home matches only) ─────────────────── */}
        {isHome && homeReadiness.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                Matchvorbereitung
              </h3>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  readyCount === totalReadiness ? "text-emerald-600" : "text-amber-600",
                )}
              >
                {readyCount} / {totalReadiness} bereit
              </span>
            </div>

            <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {homeReadiness.map((item) => (
                <div key={item.key} className="px-3">
                  <ReadinessRow
                    label={item.label}
                    value={item.value}
                    ready={item.ready}
                  />
                </div>
              ))}
            </div>

            {assessment.status === "READY" && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">Alle Aufgaben erledigt</span>
              </div>
            )}
          </div>
        )}

        {/* ── Away match: venue context only (no explanatory copy — C2) ─── */}
        {isAway && match.location && (
          <div className="space-y-1">
            <h3 className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Auswärtsspiel
            </h3>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <span className="text-[var(--foreground)]">{match.location}</span>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
