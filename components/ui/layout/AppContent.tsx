import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppContentProps = {
  /** Stacked content sections (SectionCard, AppTableShell, etc.). */
  children: ReactNode;
  /** Additional className applied to the stack wrapper. */
  className?: string;
};

/**
 * AppContent
 *
 * Vertical stack wrapper for the main body of an admin page.
 * Provides a consistent gap rhythm between stacked content sections.
 *
 * Usage:
 *   <AppPage>
 *     <AppPageHeader … />
 *     <AppContent>
 *       <AppSection title="Aktive Einheiten"> … </AppSection>
 *       <AppSection title="Archiv"> … </AppSection>
 *     </AppContent>
 *   </AppPage>
 */
export function AppContent({ children, className }: AppContentProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {children}
    </div>
  );
}
