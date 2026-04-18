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
    <div className="group rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_18px_34px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {avatar}

          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {title}
            </h3>

            {subtitle ? (
              <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
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
