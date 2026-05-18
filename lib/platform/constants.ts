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

/** Admin shell layout constraints */
export const SHELL_WIDTH_EXPANDED = 310 as const;
export const SHELL_WIDTH_COLLAPSED = 96 as const;
