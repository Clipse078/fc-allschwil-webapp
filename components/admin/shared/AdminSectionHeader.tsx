import type { ReactNode } from "react";

/**
 * AdminSectionHeader
 *
 * Internal WebApp headers must use the Premium SaaS typography standard.
 * Do not use tenant branding, football typography, or legacy fca-heading styles here.
 */
type AdminSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function AdminSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] leading-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-2)] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
