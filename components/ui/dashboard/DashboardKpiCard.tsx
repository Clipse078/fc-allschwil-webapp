import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardKpiAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "default";

const ACCENT_VARS: Record<
  DashboardKpiAccent,
  { iconBg: string; iconColor: string; subtextColor: string }
> = {
  primary: {
    iconBg: "var(--sce-primary-light)",
    iconColor: "var(--sce-primary)",
    subtextColor: "var(--sce-primary)",
  },
  info: {
    iconBg: "var(--sce-info-light)",
    iconColor: "var(--sce-info)",
    subtextColor: "var(--sce-info)",
  },
  success: {
    iconBg: "var(--sce-success-light)",
    iconColor: "var(--sce-success)",
    subtextColor: "var(--sce-success)",
  },
  warning: {
    iconBg: "var(--sce-warning-light)",
    iconColor: "var(--sce-warning)",
    subtextColor: "var(--sce-warning)",
  },
  danger: {
    iconBg: "var(--sce-danger-light)",
    iconColor: "var(--sce-danger)",
    subtextColor: "var(--sce-danger)",
  },
  default: {
    iconBg: "var(--sce-accent-subtle)",
    iconColor: "var(--sce-accent)",
    subtextColor: "var(--text-2)",
  },
};

export type DashboardKpiCardProps = {
  /** Uppercase metric label. */
  title: string;
  /** Primary numeric or text value. */
  value: string;
  /** Optional icon rendered in the top-right accent chip. */
  icon?: ReactNode;
  /** Supporting text below the value (e.g. trend label or contextual info). */
  description?: string;
  /** Semantic accent variant. No arbitrary colors — design tokens only. */
  accent?: DashboardKpiAccent;
  /** Optional action rendered below the description. */
  action?: ReactNode;
  className?: string;
};

/**
 * DashboardKpiCard
 *
 * Reusable KPI metric card for dashboard overview strips.
 * Uses only SportClubEvo semantic design tokens — no hardcoded colors.
 *
 * Replaces the legacy KpiCard from components/admin/dashboard/.
 *
 * Usage:
 *   <DashboardKpiCard
 *     title="Offene Anmeldungen"
 *     value="3"
 *     accent="warning"
 *     icon={<Users className="h-5 w-5" />}
 *     description="+2 seit gestern"
 *   />
 */
export function DashboardKpiCard({
  title,
  value,
  icon,
  description,
  accent = "default",
  action,
  className,
}: DashboardKpiCardProps) {
  const vars = ACCENT_VARS[accent];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4",
        "shadow-[var(--shadow-xs)]",
        "transition-[box-shadow,border-color] duration-[120ms]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.70rem] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-2 text-[1.875rem] font-bold leading-none tracking-tight text-[var(--foreground)]">
            {value}
          </p>
          {description && (
            <p
              className="mt-2 text-[0.75rem] font-medium"
              style={{ color: vars.subtextColor }}
            >
              {description}
            </p>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>

        {icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
            style={{ background: vars.iconBg, color: vars.iconColor }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
