import type { ReactNode } from "react";

type Props = {
  title?: string;
  emptyText: string;
  children?: ReactNode;
};

export default function AdminActionListCard({ title, emptyText, children }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {title ? <p className="text-sm font-black text-slate-900">{title}</p> : null}
      {children ? (
        <div className={title ? "mt-3 space-y-2" : "space-y-2"}>{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
          {emptyText}
        </div>
      )}
    </div>
  );
}
