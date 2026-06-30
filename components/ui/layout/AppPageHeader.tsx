import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageBreadcrumbs, PageHeader, PageActions } from "@/components/ui/page";
import type { BreadcrumbItem } from "@/components/ui/page";

type AppPageHeaderProps = {
  /**
   * Breadcrumb trail rendered above the title block.
   * Omit for top-level pages with no meaningful ancestry.
   */
  breadcrumbs?: BreadcrumbItem[];
  /** Short uppercase module label above the title (e.g. "Organisation"). */
  eyebrow?: string;
  /** Primary page title — required. */
  title: string;
  /** Optional supporting description rendered below the title. */
  description?: string;
  /** Optional badge or status pill rendered inline after the title. */
  badge?: ReactNode;
  /** Primary and secondary CTA buttons. */
  actions?: ReactNode;
  className?: string;
};

/**
 * AppPageHeader
 *
 * Unified page header for every admin module page.
 * Combines breadcrumbs, title block, and actions into one cohesive unit,
 * enforcing the canonical SportClubEvo page hierarchy:
 *
 *   Breadcrumb → Eyebrow → Title → Description → [ Actions ]
 *
 * Replaces the ad-hoc pattern of manually composing PageBreadcrumbs +
 * a flex wrapper + PageHeader + PageActions across individual pages.
 * Every admin page should use this component instead of assembling the
 * header zone from primitives directly.
 */
export function AppPageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: AppPageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <PageBreadcrumbs items={breadcrumbs} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          badge={badge}
          className="mb-0"
        />

        {actions && (
          <PageActions className="flex-shrink-0 pt-0.5">
            {actions}
          </PageActions>
        )}
      </div>
    </div>
  );
}
