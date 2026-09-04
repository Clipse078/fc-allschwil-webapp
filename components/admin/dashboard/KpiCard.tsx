import type { ReactNode } from "react";

type KpiAccent = "orange" | "blue" | "green" | "purple" | "tenant";
/** @deprecated Use `accent` instead */
type Trend = "up" | "down" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  subtext?: string;
  /** Semantic accent color for the icon background. Default: "tenant" (uses CSS vars). */
  accent?: KpiAccent;
  icon?: ReactNode;
  /** @deprecated Kept for backwards compatibility. Ignored. */
  trend?: Trend;
  /** @deprecated Kept for backwards compatibility. Ignored. */
  trendLabel?: string;
};

const ACCENT_STYLES: Record<KpiAccent, { bg: string; color: string }> = {
  orange: { bg: "var(--sce-primary-light)", color: "var(--sce-primary)" },
  blue:   { bg: "rgba(59,130,246,0.10)", color: "#3B82F6" },
  green:  { bg: "rgba(16,185,129,0.10)", color: "#10B981" },
  purple: { bg: "rgba(139,92,246,0.10)", color: "#8B5CF6" },
  tenant: { bg: "var(--tenant-accent)", color: "var(--tenant-primary)" },
};

export function KpiCard({ label, value, subtext, accent = "tenant", icon }: KpiCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div className="sce-kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.10em] text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-2 text-[1.9rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
            {value}
          </p>
          {subtext && (
            <p className="mt-2 text-[0.75rem]" style={{ color: styles.color }}>
              {subtext}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
            style={{ background: styles.bg, color: styles.color }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export type KpiCardData = KpiCardProps;
