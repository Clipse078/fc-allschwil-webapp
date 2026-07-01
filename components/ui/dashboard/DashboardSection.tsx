import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardSectionProps = {
  /** Section heading (renders a header bar with border-bottom). */
  title?: string;
  /** Optional supporting text below the title. */
  description?: string;
  /** Slot for header-level controls (right side of the header bar). */
  actions?: ReactNode;
  /** Slot rendered below the body, separated by a top border. */
  footer?: ReactNode;
  /** Remove default body padding — useful for flush list items or full-bleed content. */
  noPadding?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

/**
 * DashboardSection
 *
 * Structural card primitive for dashboard page sections.
 * Provides a consistent header / body / footer structure using
 * SportClubEvo design tokens. Replaces ad-hoc `.sce-section-card-v3` markup.
 *
 * Usage:
 *   <DashboardSection title="Schnellaktionen" actions={<Button size="sm">…</Button>}>
 *     …
 *   </DashboardSection>
 *
 *   <DashboardSection title="Aktivitäten" noPadding footer={<Link …>Alle →</Link>}>
 *     <ActivityList items={…} />
 *   </DashboardSection>
 */
export function DashboardSection({
  title,
  description,
  actions,
  footer,
  noPadding = false,
  className,
  bodyClassName,
  children,
}: DashboardSectionProps) {
  const hasHeader = !!(title || description || actions);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        "shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
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
        <div className={cn(!noPadding && "px-5 py-4", bodyClassName)}>
          {children}
        </div>
      )}

      {footer && (
        <div className="border-t border-[var(--border)] px-5 py-3">{footer}</div>
      )}
    </div>
  );
}
