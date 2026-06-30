import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppTableShellProps = {
  /** The table element or equivalent list component. */
  children: ReactNode;
  /**
   * Rendered when no data rows exist.
   * Typically an <EmptyState /> component.
   * Displayed below children — position your empty state check inside children
   * for conditional rendering, or use this prop for always-mounted placeholders.
   */
  empty?: ReactNode;
  /**
   * When true, dims the shell and blocks pointer events.
   * Use during async refresh to signal loading state.
   */
  loading?: boolean;
  /** Additional className applied to the outer wrapper. */
  className?: string;
};

/**
 * AppTableShell
 *
 * Standardised wrapper for admin data tables and searchable lists.
 * Provides consistent border, border-radius, background, overflow clipping,
 * and shadow — independent of the table implementation inside.
 *
 * Does NOT replace existing table implementations.
 * Wraps them to ensure consistent visual framing.
 *
 * Usage:
 *   <AppTableShell empty={<EmptyState heading="Keine Einträge" />}>
 *     <table className="w-full">…</table>
 *   </AppTableShell>
 */
export function AppTableShell({
  children,
  empty,
  loading = false,
  className,
}: AppTableShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        loading && "pointer-events-none opacity-60",
        className,
      )}
    >
      {children}
      {empty}
    </div>
  );
}
