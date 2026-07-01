/**
 * components/ui/patterns — SportClubEvo Premium Application Patterns
 *
 * Reusable page-level composition patterns for list, detail, form,
 * dashboard, and settings pages. Each pattern wires together the
 * lower-level primitives from @/components/ui and @/components/ui/page
 * into a consistent, module-agnostic structural shell.
 *
 * Patterns do NOT include PageShell — callers decide whether to wrap with
 * <PageShell fullWidth> based on the admin shell context.
 *
 * Canonical usage:
 *   import { ListPagePattern } from "@/components/ui/patterns";
 *   import type { ListPagePatternProps } from "@/components/ui/patterns";
 *
 * All five patterns:
 *   ListPagePattern     — list/index pages with header, stats, toolbar, table
 *   DetailPagePattern   — record detail with header, summary, two-column grid
 *   FormPagePattern     — create/edit forms with grouped sections, sticky save bar
 *   DashboardPattern    — overview with KPI strip, content grid, activity area
 *   SettingsPattern     — configuration pages with settings sections, danger zone
 */

export { ListPagePattern } from "./ListPagePattern";
export type { ListPagePatternProps } from "./ListPagePattern";

export { DetailPagePattern } from "./DetailPagePattern";
export type { DetailPagePatternProps } from "./DetailPagePattern";

export { FormPagePattern } from "./FormPagePattern";
export type { FormPagePatternProps } from "./FormPagePattern";

export { DashboardPattern } from "./DashboardPattern";
export type { DashboardPatternProps } from "./DashboardPattern";

export { SettingsPattern } from "./SettingsPattern";
export type { SettingsPatternProps } from "./SettingsPattern";

export {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableHead,
  DataTableCell,
} from "./DataTable";
