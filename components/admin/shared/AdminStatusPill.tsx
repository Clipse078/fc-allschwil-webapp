type AdminStatusPillProps = {
  label: string;
  tone?: "default" | "success" | "muted" | "warning";
};

export default function AdminStatusPill({
  label,
  tone = "default",
}: AdminStatusPillProps) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "muted"
        ? "border-slate-200 bg-slate-50 text-slate-500"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}
