import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppToolbarProps = {
  /** Search input component — typically <AppSearch />. */
  search?: ReactNode;
  /** Filter controls: dropdowns, segment chips, date pickers, etc. */
  filters?: ReactNode;
  /** Secondary utility actions: refresh, import, export, view-toggle, etc. */
  actions?: ReactNode;
  /** Primary CTA — rendered rightmost. */
  primary?: ReactNode;
  /** Additional className applied to the toolbar row. */
  className?: string;
};

/**
 * AppToolbar
 *
 * Standardised horizontal toolbar placed between the page header and content.
 * Provides consistent placement for search, filters, and utility actions.
 *
 * Layout: [ search ] [ filters ]  ————  [ actions ] [ primary ]
 *
 * Usage:
 *   <AppToolbar
 *     search={<AppSearch value={q} onChange={setQ} />}
 *     filters={<StatusFilter … />}
 *     primary={<Link href="…" className="fca-button-primary">Neu</Link>}
 *   />
 */
export function AppToolbar({
  search,
  filters,
  actions,
  primary,
  className,
}: AppToolbarProps) {
  const hasLeft = !!(search || filters);
  const hasRight = !!(actions || primary);

  if (!hasLeft && !hasRight) return null;

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2",
        hasLeft && hasRight
          ? "justify-between"
          : hasRight
            ? "justify-end"
            : "justify-start",
        className,
      )}
    >
      {hasLeft && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {search}
          {filters}
        </div>
      )}

      {hasRight && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {actions}
          {primary}
        </div>
      )}
    </div>
  );
}
