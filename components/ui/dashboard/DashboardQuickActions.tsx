import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type QuickActionAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "default";

export type QuickAction = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Semantic accent for the icon chip. Defaults to "default" (tenant primary). */
  accent?: QuickActionAccent;
};

export type DashboardQuickActionsProps = {
  actions: QuickAction[];
  className?: string;
};

const ICON_VARS: Record<
  QuickActionAccent,
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
 * DashboardQuickActions
 *
 * Standardised grid of quick-action link cards.
 * Each card has an icon chip, title, and optional subtitle.
 * Responsive: 2 columns on mobile, 4 columns from sm breakpoint.
 *
 * Uses only design tokens — no hardcoded colors.
 *
 * Usage:
 *   <DashboardQuickActions
 *     actions={[
 *       { href: "/dashboard/website/news/new", icon: <Newspaper />, title: "Neue News", accent: "info" },
 *       …
 *     ]}
 *   />
 */
export function DashboardQuickActions({
  actions,
  className,
}: DashboardQuickActionsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4",
        className,
      )}
    >
      {actions.map((action) => {
        const vars = ICON_VARS[action.accent ?? "default"];
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex items-start gap-3 rounded-xl",
              "border border-[var(--border)] bg-[var(--surface)] p-4",
              "no-underline shadow-[var(--shadow-xs)]",
              "transition-[box-shadow,border-color,transform] duration-[120ms]",
              "hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
            )}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: vars.iconBg, color: vars.iconColor }}
              aria-hidden="true"
            >
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-[var(--foreground)]">
                {action.title}
              </p>
              {action.subtitle && (
                <p className="mt-0.5 text-xs text-[var(--text-2)]">
                  {action.subtitle}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
