import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardGridProps = {
  /**
   * Primary content area. On xl+ screens: takes available space.
   */
  children: ReactNode;
  /**
   * Optional sidebar column (~300 px on xl+ screens).
   * When absent, children span the full width.
   */
  sidebar?: ReactNode;
  className?: string;
};

/**
 * DashboardGrid
 *
 * Two-column responsive layout primitive for dashboard pages.
 * Primary content on the left, optional sidebar on the right.
 *
 * Usage:
 *   <DashboardGrid sidebar={<MyRightPanel />}>
 *     <MainContent />
 *   </DashboardGrid>
 */
export function DashboardGrid({
  children,
  sidebar,
  className,
}: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        sidebar && "xl:grid-cols-[1fr_300px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {sidebar && <aside className="flex flex-col gap-6">{sidebar}</aside>}
    </div>
  );
}
