import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  /** Short uppercase label above the title (e.g. module name). */
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
 * Prop-driven page heading block. Replaces the path-keyed AdminPageHeader
 * pattern with an explicit, reusable primitive that each page owns directly.
 *
 * Design: eyebrow in tenant accent → bold display-font title → muted description.
 * Tenant-branding-ready: all colours reference CSS custom properties only.
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
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-2)]">
          {eyebrow}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {badge}
      </div>

      {description && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-2)]">
          {description}
        </p>
      )}
    </div>
  );
}
