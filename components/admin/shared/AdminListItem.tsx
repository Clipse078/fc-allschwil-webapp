import type { ReactNode } from "react";

type AdminListItemProps = {
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export default function AdminListItem({
  avatar,
  title,
  subtitle,
  meta,
  actions,
}: AdminListItemProps) {
  return (
    <div className="sce-list-card group p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {avatar}

          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-[var(--sce-heading)]">
              {title}
            </h3>

            {subtitle ? (
              <p className="mt-1 truncate text-sm text-[var(--sce-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
