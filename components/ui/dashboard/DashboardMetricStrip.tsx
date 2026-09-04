import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardMetricAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "default";

const ACCENT_COLORS: Record<DashboardMetricAccent, string> = {
  primary: "var(--sce-primary)",
  info: "var(--sce-info)",
  success: "var(--sce-success)",
  warning: "var(--sce-warning)",
  danger: "var(--sce-danger)",
  default: "var(--text-2)",
};

export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  description?: string;
  accent?: DashboardMetricAccent;
  icon?: ReactNode;
};

export type DashboardMetricStripProps = {
  metrics: DashboardMetric[];
  className?: string;
};

/**
 * DashboardMetricStrip — horizontal KPI overview without heavy bordered cards.
 */
export function DashboardMetricStrip({
  metrics,
  className,
}: DashboardMetricStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-5 lg:flex lg:items-stretch lg:gap-0",
        "border-y border-[var(--border)] py-5",
        className,
      )}
    >
      {metrics.map((metric, index) => {
        const accent = metric.accent ?? "default";
        const isLast = index === metrics.length - 1;

        return (
          <div
            key={metric.key}
            className={cn(
              "min-w-0 flex-1",
              !isLast && "lg:border-r lg:border-[var(--border)] lg:pr-6 lg:mr-6",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium text-[var(--muted)]">
                  {metric.label}
                </p>
                <p className="mt-1.5 text-[1.75rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
                  {metric.value}
                </p>
                {metric.description && (
                  <p
                    className="mt-1.5 text-[0.75rem] font-medium"
                    style={{ color: ACCENT_COLORS[accent] }}
                  >
                    {metric.description}
                  </p>
                )}
              </div>
              {metric.icon && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)]"
                  aria-hidden="true"
                >
                  {metric.icon}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
