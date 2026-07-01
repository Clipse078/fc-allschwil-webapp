import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DashboardWelcome } from "./DashboardWelcome";

export type DashboardHeroProps = {
  /** Personalised greeting (e.g. "Good morning, Admin 👋"). */
  greeting: string;
  /** Supporting subtitle below the greeting. */
  subtitle?: string;
  /** Tenant / club display name. */
  clubName?: string;
  /** Current active season label (e.g. "2025/26"). */
  activeSeason?: string;
  /** User role label(s). */
  role?: string;
  /** Today's formatted date. */
  date?: string;
  /** Header-level action controls rendered on the right. */
  actions?: ReactNode;
  className?: string;
};

/**
 * DashboardHero
 *
 * Calm, information-dense top section for dashboard pages.
 * Left: personalised greeting + subtitle.
 * Right: club meta pill (name · season · date) + optional CTA slots.
 *
 * No gradients. No football styling. Premium SaaS identity only.
 *
 * Usage:
 *   <DashboardHero
 *     greeting={greeting}
 *     subtitle="Hier ist, was heute in deinem Verein ansteht."
 *     clubName="FC Allschwil"
 *     activeSeason="2025/26"
 *     date="Di, 1. Jul 2026"
 *     actions={<Button variant="primary">Neue News</Button>}
 *   />
 */
export function DashboardHero({
  greeting,
  subtitle,
  clubName,
  activeSeason,
  role,
  date,
  actions,
  className,
}: DashboardHeroProps) {
  const hasMetaPill = !!(clubName || activeSeason || role || date);

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <DashboardWelcome greeting={greeting} subtitle={subtitle} />

      <div className="flex flex-wrap items-center gap-2.5">
        {hasMetaPill && (
          <div className="hidden items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 sm:flex">
            {clubName && (
              <span className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
                {clubName}
              </span>
            )}
            {clubName && activeSeason && (
              <span className="text-[var(--border-strong)]" aria-hidden="true">
                ·
              </span>
            )}
            {activeSeason && (
              <span className="text-[0.8125rem] text-[var(--text-2)]">
                Saison {activeSeason}
              </span>
            )}
            {activeSeason && date && (
              <span className="text-[var(--border-strong)]" aria-hidden="true">
                ·
              </span>
            )}
            {date && (
              <span className="text-[0.8125rem] text-[var(--muted)]">{date}</span>
            )}
            {role && (
              <>
                <span className="text-[var(--border-strong)]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[0.8125rem] text-[var(--text-2)]">{role}</span>
              </>
            )}
          </div>
        )}

        {actions}
      </div>
    </div>
  );
}
