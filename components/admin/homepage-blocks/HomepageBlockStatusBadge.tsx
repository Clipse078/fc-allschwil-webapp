import type { BlockStatus } from "@/lib/homepage-blocks/admin-queries";

const STATUS_LABEL: Record<BlockStatus, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

const STATUS_CLASS: Record<BlockStatus, string> = {
  DRAFT: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  SCHEDULED: "bg-amber-50 text-amber-700 border-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ARCHIVED: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] opacity-60",
};

export default function HomepageBlockStatusBadge({ status }: { status: BlockStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
