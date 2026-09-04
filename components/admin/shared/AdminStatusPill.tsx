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
      ? "border-[var(--sce-success-border)] bg-[var(--sce-success-light)] text-[var(--sce-success)]"
      : tone === "muted"
        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
        : tone === "warning"
          ? "border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] text-[var(--sce-warning)]"
          : "border-[var(--sce-info-border)] bg-[var(--sce-info-light)] text-[var(--sce-info)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}
