import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AppStatItem = {
  /** Metric label shown below the value. */
  title: string;
  /** The primary metric value (formatted string or number). */
  value: string | number;
  /** Optional supporting line below the title. */
  description?: string;
  /** Optional icon rendered to the left of the metric. */
  icon?: ReactNode;
  /**
   * Optional trend indicator — future-ready slot, not yet rendered.
   * Pass now to preserve forward compatibility without visual change.
   */
  trend?: { value: number; direction: "up" | "down" | "neutral" };
};

type AppStatsProps = {
  /** Array of stat tiles to render. */
  stats: AppStatItem[];
  /** Additional className applied to the grid wrapper. */
  className?: string;
};

/**
 * AppStats
 *
 * Horizontal KPI strip for page-level metrics.
 * Renders a responsive grid of metric tiles: [ icon ] value / title / description.
 *
 * Adapts column count automatically based on the number of stats provided.
 * Tenant-branding-ready: icon accent uses --sce-primary / --sce-accent.
 *
 * Usage:
 *   <AppStats
 *     stats={[
 *       { title: "Aktive Einheiten", value: 12, icon: <Building2 className="h-4 w-4" /> },
 *       { title: "Archiviert", value: 3 },
 *     ]}
 *   />
 */
export function AppStats({ stats, className }: AppStatsProps) {
  if (stats.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-6 grid gap-3",
        stats.length === 1 && "max-w-xs grid-cols-1",
        stats.length === 2 && "grid-cols-2",
        stats.length === 3 && "grid-cols-2 sm:grid-cols-3",
        stats.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm"
        >
          {stat.icon && (
            <div
              className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--sce-accent)", color: "var(--sce-primary)" }}
            >
              {stat.icon}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight tracking-tight text-[var(--foreground)]">
              {stat.value}
            </p>
            <p className="text-xs font-medium text-[var(--text-2)]">{stat.title}</p>
            {stat.description && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{stat.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
