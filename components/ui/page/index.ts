/**
 * components/ui/page — Sprint 1: Shared UX Foundation
 *
 * Reusable page-layout primitives for the SportClubEvo premium SaaS shell.
 * All components are:
 *   - tenant-branding-ready (CSS custom properties only, no hardcoded colours)
 *   - Inter typography ready (inherit from font stack vars)
 *   - module-agnostic and composable
 *
 * Canonical usage pattern:
 *
 *   import {
 *     PageShell,
 *     PageBreadcrumbs,
 *     PageHeader,
 *     PageActions,
 *     SectionCard,
 *     EmptyState,
 *   } from "@/components/ui/page";
 *
 * For standalone typography primitives, import from "@/components/ui/typography".
 */
export { PageShell } from "./PageShell";
export { PageBreadcrumbs } from "./PageBreadcrumbs";
export type { BreadcrumbItem } from "./PageBreadcrumbs";
export { PageHeader } from "./PageHeader";
export { PageActions } from "./PageActions";
export { SectionCard } from "./SectionCard";
export { EmptyState } from "./EmptyState";
