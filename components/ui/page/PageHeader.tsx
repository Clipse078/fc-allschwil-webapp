import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  /** Short muted label above the title (e.g. module name). */
  eyebrow?: string;
  /** Primary page title — required. */
  title: string;
  /** Optional supporting description shown below the title. */
  description?: string;
  /**
   * Optional badge or status pill rendered inline after the title.
   * Accepts any ReactNode (e.g. a <StatusBadge /> component).
   */
  badge?: ReactNode;
  className?: string;
};

/**
 * PageHeader
 *
 * Authoritative internal WebApp page header.
 *
 * Internal WebApp headers must use the Premium SaaS typography standard.
 * Do not use tenant branding, football typography, or legacy fca-heading styles here.
 *
 * Standard:
 *   - Font: Geist (system body font, var(--font-body))
 *   - Title color: neutral foreground (var(--foreground))
 *   - Title size: text-2xl / text-3xl
 *   - Title weight: font-semibold
 *   - Tracking: tracking-tight only
 *   - No uppercase on main title
 *   - No blue title color
 *   - Eyebrow: small, muted, optional — must not visually dominate
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="Teams"
 *     title="Teams pro Saison"
 *     description="Teams sind saisongeführt …"
 *   />
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-1", className)}>
      {eyebrow && (
        <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
          {eyebrow}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] leading-tight">
          {title}
        </h1>
        {badge}
      </div>

      {description && (
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-2)] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
