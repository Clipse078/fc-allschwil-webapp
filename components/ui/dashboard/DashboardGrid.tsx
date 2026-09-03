import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DashboardGridProps = {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
};

export function DashboardGrid({
  children,
  sidebar,
  className,
}: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-8",
        sidebar && "xl:grid-cols-[1fr_280px]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
      {sidebar && (
        <aside className="flex flex-col gap-6 border-t border-[var(--border)] pt-6 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-6">
          {sidebar}
        </aside>
      )}
    </div>
  );
}
