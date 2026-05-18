/**
 * SportClubEvo platform-level constants.
 *
 * IMPORTANT naming convention:
 * - PLATFORM_NAME = "SportClubEvo" — the product/software brand
 * - ACTIVE_TENANT_NAME = "FC Allschwil" — the current club using the platform
 *
 * When multi-tenant support is added (future sprint), ACTIVE_TENANT_NAME
 * will be loaded from the tenant record, not from this constant.
 */

export const PLATFORM_NAME = "SportClubEvo" as const;
export const PLATFORM_TAGLINE = "Club Management Platform" as const;

/** The currently active tenant (single-tenant deployment). */
export const ACTIVE_TENANT_NAME = "FC Allschwil" as const;
export const ACTIVE_TENANT_SLUG = "fc-allschwil" as const;
export const ACTIVE_TENANT_LOGO_SRC = "/images/logos/fc-allschwil.png" as const;

/** App base routes */
export const APP_ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  login: "/login",
  vereinsleitung: "/vereinsleitung",
} as const;

// ─── Module route bases ───────────────────────────────────────────────────────
//
// These constants centralise the current route prefixes for Meetings and
// Initiatives so they can be changed in one place when the modules are
// decoupled from Vereinsleitung.
//
// TARGET ARCHITECTURE (future sprints):
//   - Meetings   → /meetings   (standalone module, used by any org unit)
//   - Initiatives → /initiatives (standalone module, used by any org unit)
//   - Vereinsleitung → /vereinsleitung (an optional division / org-unit type)
//
// TODO(decoupling): When route migration is executed:
//   1. Update MEETINGS_ROUTE_BASE to "/meetings"
//   2. Update INITIATIVES_ROUTE_BASE to "/initiatives"
//   3. Add redirect from old paths (Next.js redirects in next.config.ts)
//   4. Update admin-route-config.ts patterns
//   5. Update admin-route-actions.ts patterns
//   6. Update get-visible-admin-nav.ts hrefs

/** Current base path for the Vereinsleitung module. */
export const VEREINSLEITUNG_ROUTE_BASE = "/vereinsleitung" as const;

/**
 * Base path for the Meetings module.
 * @deprecated Coupled to Vereinsleitung. Target: "/meetings"
 */
export const MEETINGS_ROUTE_BASE = "/vereinsleitung/meetings" as const;

/**
 * Base path for the Initiatives module.
 * @deprecated Coupled to Vereinsleitung. Target: "/initiatives"
 */
export const INITIATIVES_ROUTE_BASE = "/vereinsleitung/initiativen" as const;

/**
 * Current base path for the KPIs page.
 * @deprecated Coupled to Vereinsleitung. Target: "/kpis" (or "/targets" — name TBD)
 *
 * TODO(decoupling — KPI Module):
 * KPIs/Targets must become a standalone reusable module. It differs from Meetings
 * and Initiatives: instead of CRUD records, it manages measurable metrics with
 * time-series data, target values, and period tracking.
 *
 * Proposed canonical routes:
 *   /kpis                KPI dashboard overview
 *   /kpis/[id]           Individual metric detail + history
 *   /kpis/new            Define new metric/target
 *   /kpis/[id]/edit      Edit metric definition
 *
 * Proposed data model (Organisation Builder sprint):
 *   KpiMetric:
 *     tenantSlug, seasonId?, orgUnitLabel?
 *     key String @unique   — machine-readable metric key (e.g. "active_members")
 *     name, description?, unit? (count / % / CHF)
 *     category?            — grouping label (e.g. "Mitglieder", "Finanzen")
 *     periodType           — ANNUAL | QUARTERLY | MONTHLY
 *     targetValue Float?, currentValue Float?, previousValue Float?
 *     → KpiDataPoint[] (time-series readings)
 *   KpiDataPoint:
 *     metricId, value Float, period DateTime, notes?
 *
 *   Governance (same roadmap as Meeting + Initiative):
 *     reviewStage, accessPolicy, requiresFourEyeReview
 *
 * Module ownership model:
 *   KPIs are org-unit-agnostic — any division, team, or role can track its own metrics.
 *   orgUnitLabel (free-text) → future orgUnitId FK when Organisation Builder is live.
 *
 * Blocker: no real data model exists — currently 100% static mock data.
 * Migration sprint should design KpiMetric + KpiDataPoint before any route work.
 */
export const KPI_ROUTE_BASE = "/vereinsleitung/kpis" as const;

/** Admin shell layout constraints */
export const SHELL_WIDTH_EXPANDED = 310 as const;
export const SHELL_WIDTH_COLLAPSED = 96 as const;
