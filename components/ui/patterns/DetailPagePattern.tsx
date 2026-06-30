import type { ReactNode } from "react";
import {
  PageBreadcrumbs,
  PageHeader,
  PageActions,
} from "@/components/ui/page";
import type { BreadcrumbItem } from "@/components/ui/page";
import { LoadingSkeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

export type DetailPagePatternProps = {
  // ── Header ────────────────────────────────────────────────────────────────
  /** Short uppercase eyebrow label above the title. */
  eyebrow?: string;
  /** Primary page title (record name, document title, etc.). */
  title: string;
  /** Optional supporting description. */
  description?: string;
  /** Optional badge rendered inline after the title (e.g. status pill). */
  headerBadge?: ReactNode;
  /** Breadcrumb trail shown above the header. */
  breadcrumbs?: BreadcrumbItem[];
  /** Primary header-level CTAs (top-right: edit, delete, export…). */
  headerActions?: ReactNode;
  // ── Summary ────────────────────────────────────────────────────────────────
  /**
   * Optional summary / metadata panel shown below the header and above the
   * main content grid. Typically a Card with key record attributes.
   */
  summary?: ReactNode;
  // ── Main grid ──────────────────────────────────────────────────────────────
  /**
   * Primary content column. On lg+ screens this becomes the wider left column
   * when a sidebar is provided.
   */
  children: ReactNode;
  /**
   * Optional right sidebar column (lg+ screens: ~320 px wide).
   * Use for supplementary info: activity feed, quick actions, related records.
   */
  sidebar?: ReactNode;
  // ── Loading ────────────────────────────────────────────────────────────────
  /** When true, renders a full-page skeleton in place of summary + content. */
  loading?: boolean;
  // ── Shell ──────────────────────────────────────────────────────────────────
  className?: string;
};

/**
 * DetailPagePattern
 *
 * Reusable structural shell for record-detail / show pages.
 * Composes: PageBreadcrumbs · PageHeader · PageActions · LoadingSkeleton
 *
 * Does NOT include PageShell — callers wrap with <PageShell fullWidth> when
 * using inside the admin layout.
 *
 * Structure:
 *   breadcrumbs → header row (title + badge + actions) → summary
 *   → two-column grid [main content | sidebar]
 *
 * Usage:
 *   <PageShell fullWidth>
 *     <DetailPagePattern
 *       eyebrow="Teams"
 *       title="FC Musterhausen U18"
 *       headerBadge={<Badge variant="success">Aktiv</Badge>}
 *       breadcrumbs={[
 *         { label: "Dashboard", href: "/dashboard" },
 *         { label: "Teams", href: "/dashboard/teams" },
 *         { label: "FC Musterhausen U18" },
 *       ]}
 *       headerActions={<Button variant="secondary">Bearbeiten</Button>}
 *       summary={<TeamMetaCard team={team} />}
 *       sidebar={<ActivityFeed items={activity} />}
 *       loading={isLoading}
 *     >
 *       <SectionCard title="Mitglieder">…</SectionCard>
 *       <SectionCard title="Spielplan">…</SectionCard>
 *     </DetailPagePattern>
 *   </PageShell>
 */
export function DetailPagePattern({
  eyebrow,
  title,
  description,
  headerBadge,
  breadcrumbs,
  headerActions,
  summary,
  children,
  sidebar,
  loading = false,
  className,
}: DetailPagePatternProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <PageBreadcrumbs items={breadcrumbs} />
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          badge={headerBadge}
          className="mb-0"
        />
        {headerActions && <PageActions>{headerActions}</PageActions>}
      </div>

      {loading ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <>
          {summary && <div className="mb-6">{summary}</div>}

          {sidebar ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="flex min-w-0 flex-col gap-6">{children}</div>
              <aside className="flex flex-col gap-6">{sidebar}</aside>
            </div>
          ) : (
            <div className="flex flex-col gap-6">{children}</div>
          )}
        </>
      )}
    </div>
  );
}
