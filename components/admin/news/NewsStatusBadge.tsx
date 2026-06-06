import type { ArticleStatus } from "@/lib/news/admin-queries";

const STATUS_STYLES: Record<ArticleStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Entwurf",
    className: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  },
  SCHEDULED: {
    label: "Geplant",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PUBLISHED: {
    label: "Veröffentlicht",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ARCHIVED: {
    label: "Archiviert",
    className: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-60",
  },
};

type NewsStatusBadgeProps = {
  status: ArticleStatus;
};

export default function NewsStatusBadge({ status }: NewsStatusBadgeProps) {
  const { label, className } = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}
