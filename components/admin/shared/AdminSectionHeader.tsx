import type { ReactNode } from "react";

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
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-2)]">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
