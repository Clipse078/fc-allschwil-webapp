import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type CenterPeriodNavigationProps = {
  /** Human-readable label for the current period, e.g. "August 2026". */
  label: string;
  /** URL for the previous period. */
  previousHref: string;
  /** URL for the next period. */
  nextHref: string;
  /** Optional "Heute" / "Today" shortcut href — renders a button when provided. */
  todayHref?: string;
  /** Optional extra content rendered to the right of the navigation. */
  trailing?: React.ReactNode;
  className?: string;
  /**
   * Optional data-testid overrides for each interactive element.
   * Allows consumers to apply domain-specific testids without coupling the
   * shared primitive to any specific center's test contract.
   */
  "data-testid-label"?: string;
  "data-testid-previous"?: string;
  "data-testid-next"?: string;
  "data-testid-today"?: string;
};

/**
 * CenterPeriodNavigation
 *
 * Compact period navigation bar shared by MatchCenter (and available for
 * future TrainingCenter / TournamentCenter use).
 *
 * Renders a prev ‹ / label / next › row with an optional "Heute" shortcut.
 * All navigation is link-based (server navigation, no client state).
 *
 * MATCHCENTER-UX-03 §8 — deliberately compact to reduce wasted vertical space.
 */
export function CenterPeriodNavigation({
  label,
  previousHref,
  nextHref,
  todayHref,
  trailing,
  className,
  "data-testid-label": testIdLabel,
  "data-testid-previous": testIdPrevious,
  "data-testid-next": testIdNext,
  "data-testid-today": testIdToday,
}: CenterPeriodNavigationProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        href={previousHref}
        aria-label="Vorheriger Zeitraum"
        data-testid={testIdPrevious ?? "center-period-previous"}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md",
          "text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <span
        className="min-w-[10rem] text-center text-sm font-semibold text-[var(--foreground)]"
        data-testid={testIdLabel ?? "center-period-label"}
        aria-live="polite"
      >
        {label}
      </span>

      <Link
        href={nextHref}
        aria-label="Nächster Zeitraum"
        data-testid={testIdNext ?? "center-period-next"}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md",
          "text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>

      {todayHref && (
        <Link
          href={todayHref}
          data-testid={testIdToday ?? "center-period-today"}
          className={cn(
            "ml-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium",
            "text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]",
          )}
        >
          Heute
        </Link>
      )}

      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
