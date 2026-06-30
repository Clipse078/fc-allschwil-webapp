import { Badge } from "@/components/ui";
import type { ArticleStatus } from "@/lib/news/admin-queries";

const STATUS_CONFIG: Record<
  ArticleStatus,
  { label: string; variant: "default" | "info" | "warning" | "success" }
> = {
  DRAFT:     { label: "Entwurf",        variant: "default" },
  IN_REVIEW: { label: "In Prüfung",     variant: "info" },
  SCHEDULED: { label: "Geplant",        variant: "warning" },
  PUBLISHED: { label: "Veröffentlicht", variant: "success" },
  ARCHIVED:  { label: "Archiviert",     variant: "default" },
};

type NewsStatusBadgeProps = {
  status: ArticleStatus;
};

export default function NewsStatusBadge({ status }: NewsStatusBadgeProps) {
  const { label, variant } = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}
