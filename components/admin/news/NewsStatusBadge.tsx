import type { NewsArticleStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  NewsArticleStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Entwurf",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  IN_REVIEW: {
    label: "In Prüfung",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  APPROVED: {
    label: "Freigegeben",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  PUBLISHED: {
    label: "Veröffentlicht",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ARCHIVED: {
    label: "Archiviert",
    className: "border-red-200 bg-red-50 text-red-600",
  },
};

type Props = { status: NewsArticleStatus };

export default function NewsStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
