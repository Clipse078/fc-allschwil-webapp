import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardActionTileProps = {
  href: string;
  label: string;
  count: number;
  icon: ReactNode;
  /** Subtext shown below the count. */
  subtext?: string;
  /**
   * When true (count > 0), render a tenant-primary left border accent
   * to draw attention to actionable items.
   */
  urgent?: boolean;
};

/**
 * DashboardActionTile
 *
 * A compact, clickable KPI tile for the Action Center. Links directly to
 * the relevant module. Highlights when count > 0 and urgent=true.
 */
export function DashboardActionTile({
  href,
  label,
  count,
  icon,
  subtext,
  urgent = false,
}: DashboardActionTileProps) {
  const isUrgent = urgent && count > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-[var(--card)] p-5",
        "shadow-[var(--shadow-xs)] transition-all duration-150",
        "hover:shadow-[var(--shadow-md)] hover:border-[var(--border-strong)] hover:-translate-y-[1px]",
        isUrgent ? "border-[var(--border-strong)]" : "border-[var(--border)]",
      )}
    >
      {/* Tenant-primary left accent strip when urgent */}
      {isUrgent && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-[2px]"
          style={{ background: "var(--tenant-primary)" }}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
          style={{
            background: "var(--tenant-accent)",
            color: "var(--tenant-primary)",
          }}
        >
          {icon}
        </div>
      </div>

      <p
        className="text-[2rem] font-bold leading-none tracking-tight text-[var(--foreground)]"
      >
        {count}
      </p>

      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
          {label}
        </p>
        {subtext && (
          <p className="mt-0.5 text-[0.72rem] text-[var(--text-2)]">{subtext}</p>
        )}
      </div>
    </Link>
  );
}
