import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageEyebrow, PageTitle, PageSubtitle } from "@/components/ui/typography";

type PageHeaderProps = {
  /** Short uppercase label above the title (e.g. module name). */
  eyebrow?: string;
  /** Primary page title — required. */
  title: string;
  /** Optional supporting description shown below the title. */
  description?: string;
  /**
   * Optional badge or status pill rendered inline after the title.
   * Accepts any ReactNode (e.g. a <StatusBadge /> component).
   */
  badge?: ReactNode;
  className?: string;
};

/**
 * PageHeader
 *
 * Prop-driven page heading block. Canonical page-level header primitive.
 * All colours reference CSS custom properties only — tenant-branding-ready.
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="Teams"
 *     title="Teams pro Saison"
 *     description="Teams sind saisongeführt …"
 *   />
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-1.5", className)}>
      {eyebrow && <PageEyebrow>{eyebrow}</PageEyebrow>}

      <div className="flex flex-wrap items-center gap-2.5">
        <PageTitle className="leading-tight">{title}</PageTitle>
        {badge}
      </div>

      {description && (
        <PageSubtitle className="mt-1">{description}</PageSubtitle>
      )}
    </div>
  );
}
