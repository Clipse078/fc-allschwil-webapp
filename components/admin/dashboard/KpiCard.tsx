import type { ReactNode } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

type Trend = "up" | "down" | "neutral";

type KpiCardProps = {
  label: string;
  value: string;
  subtext?: string;
  trend?: Trend;
  trendLabel?: string;
  icon?: ReactNode;
};

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-[var(--muted)]" />;
}

export function KpiCard({
  label,
  value,
  subtext,
  trend = "neutral",
  trendLabel,
  icon,
}: KpiCardProps) {
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
          {(subtext || trendLabel) && (
            <div className="mt-2 flex items-center gap-1.5">
              {trend !== "neutral" && <TrendIcon trend={trend} />}
              <p className="text-[0.75rem] text-[var(--text-2)]">
                {trendLabel ?? subtext}
              </p>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
            style={{ background: "var(--tenant-accent)", color: "var(--tenant-primary)" }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export type KpiCardData = KpiCardProps;
