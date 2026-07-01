import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type ActivityIconAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "default";

export type DashboardActivityItem = {
  key: string;
  icon: ReactNode;
  /** Semantic accent for the icon chip. Defaults to "default". */
  iconAccent?: ActivityIconAccent;
  title: string;
  subtitle?: string;
  /** Relative timestamp string (e.g. "Vor 3 Min."). */
  timestamp: string;
  /** Optional category tag. */
  tag?: string;
  /** Badge variant for the tag pill. Defaults to "default". */
  tagVariant?: BadgeVariant;
};

export type DashboardActivityFeedProps = {
  items: DashboardActivityItem[];
  /** Rendered when items is empty. */
  emptyState?: ReactNode;
  className?: string;
};

const ICON_VARS: Record<
  ActivityIconAccent,
  { iconBg: string; iconColor: string }
> = {
  primary: { iconBg: "var(--sce-primary-light)", iconColor: "var(--sce-primary)" },
  info:    { iconBg: "var(--sce-info-light)",    iconColor: "var(--sce-info)" },
  success: { iconBg: "var(--sce-success-light)", iconColor: "var(--sce-success)" },
  warning: { iconBg: "var(--sce-warning-light)", iconColor: "var(--sce-warning)" },
  danger:  { iconBg: "var(--sce-danger-light)",  iconColor: "var(--sce-danger)" },
  default: { iconBg: "var(--tenant-accent)",     iconColor: "var(--tenant-primary)" },
};

/**
 * DashboardActivityFeed
 *
 * Structured activity timeline for dashboard pages.
 * Each row shows an icon chip, title, subtitle, timestamp, and optional tag Badge.
 *
 * Reuses existing activity data — does NOT change queries.
 * Uses only design tokens — no hardcoded colors.
 *
 * Usage:
 *   <DashboardActivityFeed
 *     items={activities}
 *     emptyState={<DashboardEmptyState title="Noch keine Aktivitäten" />}
 *   />
 */
export function DashboardActivityFeed({
  items,
  emptyState,
  className,
}: DashboardActivityFeedProps) {
  if (items.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {items.map((item, idx) => {
        const vars = ICON_VARS[item.iconAccent ?? "default"];
        const isLast = idx === items.length - 1;

        return (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-3 py-3",
              !isLast && "border-b border-[var(--border)]",
            )}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: vars.iconBg, color: vars.iconColor }}
              aria-hidden="true"
            >
              {item.icon}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="mt-0.5 truncate text-xs text-[var(--text-2)]">
                  {item.subtitle}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-xs text-[var(--muted)]">{item.timestamp}</span>
              {item.tag && (
                <Badge variant={item.tagVariant ?? "default"} size="sm">
                  {item.tag}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
