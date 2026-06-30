import type { ReactNode } from "react";
import { PageHeader, PageActions } from "@/components/ui/page";
import { cn } from "@/lib/cn";

export type DashboardPatternProps = {
  // ── Header ────────────────────────────────────────────────────────────────
  /** Short uppercase eyebrow label above the title. */
  eyebrow?: string;
  /** Primary dashboard title. */
  title: string;
  /** Optional supporting description. */
  description?: string;
  /** Optional badge rendered inline after the title. */
  headerBadge?: ReactNode;
  /** Header-level CTAs (top-right: e.g. period selector, quick-add). */
  headerActions?: ReactNode;
  // ── KPI strip ──────────────────────────────────────────────────────────────
  /**
   * Row of KPI / metric cards rendered directly below the header.
   * Typically a grid of <Card variant="metric"> or <CmsStatCard> components.
   */
  kpiStrip?: ReactNode;
  // ── Main grid ──────────────────────────────────────────────────────────────
  /**
   * Primary large content area (left column on lg+ screens).
   * Use for charts, primary tables, or the main module content.
   */
  children: ReactNode;
  /**
   * Secondary sidebar column (lg+ screens: ~320 px wide).
   * Use for quick actions, upcoming events, or condensed supplementary info.
   */
  sidebar?: ReactNode;
  // ── Activity ────────────────────────────────────────────────────────────────
  /**
   * Activity / feed row rendered below the primary content grid.
   * Spans the full width of the grid area.
   */
  activity?: ReactNode;
  // ── Shell ──────────────────────────────────────────────────────────────────
  className?: string;
};

/**
 * DashboardPattern
 *
 * Reusable structural shell for dashboard / overview pages.
 * Composes: PageHeader · PageActions
 *
 * Does NOT include PageShell — callers wrap with <PageShell fullWidth> when
 * using inside the admin layout.
 *
 * Structure:
 *   header row (title + actions) → KPI strip
 *   → two-column grid [primary content | sidebar] → activity area
 *
 * Usage:
 *   <PageShell fullWidth>
 *     <DashboardPattern
 *       eyebrow="Vereinsmanagement"
 *       title="Dashboard"
 *       headerActions={<PeriodSelector />}
 *       kpiStrip={
 *         <div className="grid gap-4 sm:grid-cols-4">
 *           <Card variant="metric">…</Card>
 *           …
 *         </div>
 *       }
 *       sidebar={<QuickLinks />}
 *       activity={<RecentActivity />}
 *     >
 *       <SectionCard title="Anstehende Events">…</SectionCard>
 *       <SectionCard title="Mitgliederübersicht">…</SectionCard>
 *     </DashboardPattern>
 *   </PageShell>
 */
export function DashboardPattern({
  eyebrow,
  title,
  description,
  headerBadge,
  headerActions,
  kpiStrip,
  children,
  sidebar,
  activity,
  className,
}: DashboardPatternProps) {
  return (
    <div className={cn("flex flex-col", className)}>
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

      {kpiStrip && <div className="mb-6">{kpiStrip}</div>}

      <div
        className={cn(
          "grid gap-6",
          sidebar ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1",
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        {sidebar && <aside className="flex flex-col gap-6">{sidebar}</aside>}
      </div>

      {activity && <div className="mt-6">{activity}</div>}
    </div>
  );
}
