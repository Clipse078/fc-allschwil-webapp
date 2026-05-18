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

/** Admin shell layout constraints */
export const SHELL_WIDTH_EXPANDED = 310 as const;
export const SHELL_WIDTH_COLLAPSED = 96 as const;
