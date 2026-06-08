import type { ReactNode } from "react";
import { PageEyebrow, PageSubtitle } from "@/components/ui/typography";

type AdminSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/**
 * AdminSectionHeader
 *
 * Canonical page-level header for dashboard/admin pages.
 * Uses shared typography primitives for consistent Premium SaaS look.
 */
export default function AdminSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <PageEyebrow>{eyebrow}</PageEyebrow> : null}
        <h2 className="fca-heading mt-2">{title}</h2>
        {description ? (
          <PageSubtitle className="mt-2">{description}</PageSubtitle>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
