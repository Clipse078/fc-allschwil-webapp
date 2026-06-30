/**
 * components/ui/layout — SportClubEvo Premium SaaS Shell
 *
 * Reusable layout framework — the single visual foundation every admin module
 * page inherits. Eliminates UI drift by enforcing one canonical page hierarchy:
 *
 *   AppPage
 *   └─ AppPageHeader   (breadcrumbs · eyebrow · title · description · actions)
 *   └─ AppStats?       (optional KPI strip)
 *   └─ AppToolbar?     (search · filters · utility actions)
 *   └─ AppContent
 *      └─ AppSection / AppTableShell
 *
 * Canonical usage:
 *
 *   import {
 *     AppPage,
 *     AppPageHeader,
 *     AppToolbar,
 *     AppSearch,
 *     AppStats,
 *     AppContent,
 *     AppSection,
 *     AppActions,
 *     AppTableShell,
 *   } from "@/components/ui/layout";
 *
 * AppSection and AppActions are re-exported from @/components/ui/page to
 * avoid duplication of well-tested existing primitives.
 */

// ── Core page shell ─────────────────────────────────────────────────────────
export { AppPage } from "./AppPage";
export { AppPageHeader } from "./AppPageHeader";

// ── Toolbar & search ─────────────────────────────────────────────────────────
export { AppToolbar } from "./AppToolbar";
export { AppSearch } from "./AppSearch";

// ── KPI strip ────────────────────────────────────────────────────────────────
export { AppStats } from "./AppStats";
export type { AppStatItem } from "./AppStats";

// ── Content wrappers ─────────────────────────────────────────────────────────
export { AppContent } from "./AppContent";
export { AppTableShell } from "./AppTableShell";

// ── Re-exported primitives from components/ui/page ───────────────────────────
// Aliased to the App* namespace for consistent import paths across modules.
// The underlying implementations remain in components/ui/page — no duplication.
export { SectionCard as AppSection } from "@/components/ui/page";
export { PageActions as AppActions } from "@/components/ui/page";
export { EmptyState } from "@/components/ui/page";
export { PageBreadcrumbs } from "@/components/ui/page";
export type { BreadcrumbItem } from "@/components/ui/page";
