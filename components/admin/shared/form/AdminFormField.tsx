import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  hint?: string;
};

export default function AdminFormField({ label, children, hint }: Props) {
  return (
    <label className="block space-y-2">
      <span className="fca-label">{label}</span>
      {children}
      {hint ? <span className="block text-xs font-semibold text-slate-400">{hint}</span> : null}
    </label>
  );
}
