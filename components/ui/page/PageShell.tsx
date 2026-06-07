import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageShellProps = {
  /** Full-width scroll container. Wrap page body content here. */
  children: ReactNode;
  /** Additional className applied to the outer wrapper. */
  className?: string;
  /**
   * Set to true for pages that should render edge-to-edge without the
   * standard horizontal padding (e.g. full-bleed map or table views).
   */
  fullWidth?: boolean;
};

/**
 * PageShell
 *
 * The outermost layout primitive for every admin/module page. Provides
 * consistent vertical rhythm, horizontal gutter, and max-width constraint
 * aligned with the SportClubEvo premium SaaS shell.
 *
 * Usage:
 *   <PageShell>
 *     <PageHeader … />
 *     <SectionCard> … </SectionCard>
 *   </PageShell>
 */
export function PageShell({ children, className, fullWidth = false }: PageShellProps) {
  return (
    <main
      className={cn(
        "flex min-h-full flex-col",
        !fullWidth && "mx-auto w-full max-w-screen-xl px-5 py-8 md:px-8 md:py-10",
        className,
      )}
    >
      {children}
    </main>
  );
}
