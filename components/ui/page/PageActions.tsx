import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageActionsProps = {
  /** Action buttons or links to render. */
  children: ReactNode;
  /**
   * Alignment of actions.
   * - "start" – left-aligned (default, useful for inline-with-header rows)
   * - "end" – right-aligned (default for standalone action bars)
   */
  align?: "start" | "end";
  className?: string;
};

/**
 * PageActions
 *
 * A flex container for page-level CTA buttons placed in the page header zone.
 * Each child should be a `<Link>` or `<button>` using the shared button styles
 * (e.g. `.sce-btn-primary`, `.sce-btn-ghost`).
 *
 * Prefer composing PageHeader + PageActions in a flex row at the top of a
 * PageShell rather than using the old path-keyed AdminPageActions component.
 *
 * Usage:
 *   <div className="flex items-start justify-between gap-4">
 *     <PageHeader title="Teams" … />
 *     <PageActions>
 *       <button className="sce-btn-primary">Neues Team</button>
 *     </PageActions>
 *   </div>
 */
export function PageActions({ children, align = "end", className }: PageActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
