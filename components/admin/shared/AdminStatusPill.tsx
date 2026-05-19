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
      ? "sce-chip-success"
      : tone === "muted"
        ? ""
        : tone === "warning"
          ? "sce-chip-warning"
          : "sce-chip-primary";

  return (
    <span
      className={`sce-chip px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}
