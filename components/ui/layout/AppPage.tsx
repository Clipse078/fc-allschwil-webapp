import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppPageProps = {
  /** Page body content. */
  children: ReactNode;
  /** Additional className applied to the outer wrapper. */
  className?: string;
  /**
   * When false, constrains page to max-width with gutters.
   * Defaults to true — full-width is standard for admin data pages.
   */
  fullWidth?: boolean;
};

/**
 * AppPage
 *
 * The canonical outer container for every admin module page.
 * Provides consistent vertical rhythm, horizontal gutter, and max-width
 * constraint aligned with the SportClubEvo premium SaaS shell.
 *
 * Uses <div> (not <main>) since app/(admin)/layout.tsx already provides
 * the semantic <main> landmark.
 *
 * Usage:
 *   <AppPage>
 *     <AppPageHeader … />
 *     <AppContent> … </AppContent>
 *   </AppPage>
 */
export function AppPage({ children, className, fullWidth = true }: AppPageProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-col",
        !fullWidth && "mx-auto w-full max-w-screen-xl px-5 py-8 md:px-8 md:py-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
