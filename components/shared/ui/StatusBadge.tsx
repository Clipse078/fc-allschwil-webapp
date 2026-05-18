export type StatusBadgeTone = "default" | "success" | "warning" | "danger" | "muted" | "info";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  default: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger:  "border-red-200 bg-red-50 text-red-700",
  muted:   "border-slate-200 bg-slate-50 text-slate-500",
  info:    "border-sky-200 bg-sky-50 text-sky-700",
};

export default function StatusBadge({
  label,
  tone = "default",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
