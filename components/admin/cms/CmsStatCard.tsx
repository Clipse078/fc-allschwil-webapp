/**
 * CmsStatCard
 *
 * Compact KPI card for the CMS overview dashboard.
 * Displays a headline metric with an optional sub-label and link.
 * Server component — purely presentational.
 */

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: number | string;
  subLabel?: string;
  href?: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  /** Optional attention indicator (e.g. action needed). */
  alert?: boolean;
};

export function CmsStatCard({
  label,
  value,
  subLabel,
  href,
  icon,
  iconBg,
  iconColor,
  alert = false,
}: Props) {
  const inner = (
    <div className="flex items-start gap-4 px-5 py-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--text-2)] truncate">{label}</p>
        <p
          className="mt-0.5 text-2xl font-bold leading-none"
          style={{ color: alert ? "#F59E0B" : "var(--foreground)" }}
        >
          {value}
        </p>
        {subLabel && (
          <p className="mt-1 text-xs text-[var(--muted)] truncate">{subLabel}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden transition-shadow hover:shadow-md">
        <Link href={href} className="block">
          {inner}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      {inner}
    </div>
  );
}
