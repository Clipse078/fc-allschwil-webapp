import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionCardProps = {
  children: ReactNode;
  /**
   * Optional card-level title rendered in a header stripe above the body.
   * Omit for seamless, borderless content blocks.
   */
  title?: string;
  /**
   * Optional description rendered below the title in the header stripe.
   */
  description?: string;
  /**
   * Optional slot for header-level actions (e.g. a filter or add button).
   * Rendered to the right of title + description.
   */
  headerActions?: ReactNode;
  /**
   * Remove the default card padding — useful when the child is a full-bleed
   * table, map, or image.
   */
  noPadding?: boolean;
  /**
   * Show a subtle left-border accent in the tenant primary color.
   * Use for cards that represent a primary action or branded section.
   */
  accent?: boolean;
  className?: string;
  /** Additional className applied to the inner content area only. */
  bodyClassName?: string;
};

/**
 * SectionCard
 *
 * A content-grouping primitive that wraps a logical section of a page in a
 * clean, elevated surface. Follows the SportClubEvo premium SaaS aesthetic:
 * white surface, subtle border, light shadow, rounded corners.
 *
 * Usage:
 *   <SectionCard title="Letzte Events" headerActions={<FilterButton />}>
 *     <EventTable … />
 *   </SectionCard>
 */
export function SectionCard({
  children,
  title,
  description,
  headerActions,
  noPadding = false,
  accent = false,
  className,
  bodyClassName,
}: SectionCardProps) {
  const hasHeader = !!(title || description || headerActions);

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden",
        accent && "border-l-2",
        className,
      )}
      style={accent ? { borderLeftColor: "var(--sce-primary)" } : undefined}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
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
          {headerActions && (
            <div className="flex flex-shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      <div className={cn(!noPadding && "px-5 py-4", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
