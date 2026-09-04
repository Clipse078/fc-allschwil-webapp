import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export type DashboardActivityItem = {
  key: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  timestamp: string;
  tag?: string;
  tagVariant?: BadgeVariant;
};

export type DashboardActivityFeedProps = {
  items: DashboardActivityItem[];
  emptyState?: ReactNode;
  className?: string;
};

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
        const isLast = idx === items.length - 1;

        return (
          <div
            key={item.key}
            className={cn(
              "group flex items-center gap-3 py-3.5 transition-colors duration-[120ms]",
              "hover:bg-[var(--surface-2)] -mx-2 px-2 rounded-lg",
              !isLast && "border-b border-[var(--border)]",
            )}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted)]"
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
