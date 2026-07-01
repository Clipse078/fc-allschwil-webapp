import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * DashboardEmptyState
 *
 * Centered empty state for dashboard sections with no data.
 * Uses design tokens only — no hardcoded colors.
 */
export function DashboardEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 py-8 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-[var(--muted)]" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-[var(--text-2)]">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
