import type { NewsArticleStatus } from "@prisma/client";

type Props = { status: NewsArticleStatus };

const CONFIG: Record<
  NewsArticleStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Entwurf",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  REVIEW: {
    label: "Review",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  APPROVED: {
    label: "Genehmigt",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  PUBLISHED: {
    label: "Publiziert",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  ARCHIVED: {
    label: "Archiviert",
    className: "border-slate-200 bg-slate-50 text-slate-400",
  },
};

export default function NewsStatusBadge({ status }: Props) {
  const { label, className } = CONFIG[status] ?? CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
}
