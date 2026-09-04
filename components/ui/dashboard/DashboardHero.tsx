import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DashboardWelcome } from "./DashboardWelcome";

export type DashboardHeroProps = {
  greeting: string;
  subtitle?: string;
  clubName?: string;
  activeSeason?: string;
  role?: string;
  date?: string;
  actions?: ReactNode;
  className?: string;
};

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
  const metaParts = [
    clubName,
    activeSeason ? `Saison ${activeSeason}` : null,
    date,
    role,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <DashboardWelcome greeting={greeting} subtitle={subtitle} />

      <div className="flex flex-wrap items-center gap-2.5">
        {metaParts.length > 0 && (
          <p className="text-[0.8125rem] text-[var(--muted)]">
            {metaParts.join(" · ")}
          </p>
        )}
        {actions}
      </div>
    </div>
  );
}
