import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type QuickAction = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
};

export type DashboardQuickActionsProps = {
  actions: QuickAction[];
  className?: string;
};

/**
 * Compact command rail — efficient actions without nested card chrome.
 */
export function DashboardQuickActions({
  actions,
  className,
}: DashboardQuickActionsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 sm:grid-cols-4",
        className,
      )}
    >
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex items-start gap-3 rounded-lg px-3 py-2.5 no-underline",
            "transition-colors duration-[120ms]",
            "hover:bg-[var(--surface-2)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              "text-[var(--text-2)] transition-colors duration-[120ms]",
              "group-hover:text-[var(--sce-primary)]",
            )}
            aria-hidden="true"
          >
            {action.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight text-[var(--foreground)]">
              {action.title}
            </p>
            {action.subtitle && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {action.subtitle}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
