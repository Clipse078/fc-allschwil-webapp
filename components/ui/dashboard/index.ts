/**
 * components/ui/dashboard — SportClubEvo Dashboard Primitives
 *
 * Shared, reusable dashboard layout components.
 * All use SCE design tokens only — no hardcoded colors.
 *
 * Canonical usage:
 *   import { DashboardHero, DashboardKpiCard, DashboardSection } from "@/components/ui/dashboard";
 */

export { DashboardHero } from "./DashboardHero";
export type { DashboardHeroProps } from "./DashboardHero";

export { DashboardWelcome } from "./DashboardWelcome";
export type { DashboardWelcomeProps } from "./DashboardWelcome";

export { DashboardKpiCard } from "./DashboardKpiCard";
export type { DashboardKpiCardProps, DashboardKpiAccent } from "./DashboardKpiCard";

export { DashboardQuickActions } from "./DashboardQuickActions";
export type { DashboardQuickActionsProps, QuickAction } from "./DashboardQuickActions";

export { DashboardActivityFeed } from "./DashboardActivityFeed";
export type {
  DashboardActivityFeedProps,
  DashboardActivityItem,
} from "./DashboardActivityFeed";

export { DashboardSmartNudges } from "./DashboardSmartNudges";
export type { DashboardSmartNudgesProps } from "./DashboardSmartNudges";

export { DashboardSection } from "./DashboardSection";
export type { DashboardSectionProps } from "./DashboardSection";

export { DashboardGrid } from "./DashboardGrid";
export type { DashboardGridProps } from "./DashboardGrid";

export { DashboardEmptyState } from "./DashboardEmptyState";
export type { DashboardEmptyStateProps } from "./DashboardEmptyState";
