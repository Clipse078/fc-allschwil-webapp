import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardSectionVariant = "flat" | "card";

export type DashboardSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
  variant?: DashboardSectionVariant;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function DashboardSection({
  title,
  description,
  actions,
  footer,
  noPadding = false,
  variant = "flat",
  className,
  bodyClassName,
  children,
}: DashboardSectionProps) {
  const hasHeader = !!(title || description || actions);
  const isCard = variant === "card";

  return (
    <section
      className={cn(
        isCard && "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            isCard ? "border-b border-[var(--border)] px-5 py-4" : "pb-3",
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--text-2)]">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}

      {children !== undefined && (
        <div className={cn(!noPadding && (isCard ? "px-5 py-4" : "py-1"), bodyClassName)}>
          {children}
        </div>
      )}

      {footer && (
        <div
          className={cn(
            "pt-3",
            isCard && "border-t border-[var(--border)] px-5 py-3",
          )}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
