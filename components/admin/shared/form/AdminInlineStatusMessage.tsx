import type { ReactNode } from "react";

type Tone = "info" | "success" | "error" | "warning";

type Props = {
  tone?: Tone;
  children: ReactNode;
};

const toneClassNames: Record<Tone, string> = {
  info: "border-blue-100 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function AdminInlineStatusMessage({ tone = "info", children }: Props) {
  return (
    <div className={"rounded-2xl border px-4 py-3 text-sm font-semibold " + toneClassNames[tone]}>
      {children}
    </div>
  );
}
