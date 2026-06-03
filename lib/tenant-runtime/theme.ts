/**
 * Canonical Tenant Runtime Theme — Slice 10.6
 *
 * Generates CSS custom property maps from resolved tenant branding.
 * All tenant-aware color injection in the application goes through this module.
 *
 * ─── Principles ─────────────────────────────────────────────────────────────
 *
 * - One canonical source of truth for the CSS variable → branding value mapping.
 * - generateTenantCssVars() returns a plain Record<string, string>.
 *   Callers apply it however suits their context:
 *     • React inline style prop (cast to React.CSSProperties)
 *     • Serialised to a CSS string for a <style> tag
 * - Does NOT touch the global --blue / --red / --sce-* / --color-brand-* tokens.
 *   Those are fixed SportClubEvo UX tokens defined in globals.css and unchanged.
 * - Does NOT import from prisma or next/server — client-safe.
 *
 * ─── CSS variable namespace ──────────────────────────────────────────────────
 *
 *   --tenant-primary    Primary brand color (hex)
 *   --tenant-secondary  Secondary/accent brand color (hex)
 *
 * These vars are additive: existing components continue using --blue / --red.
 * Future tenant-branded surfaces opt in to --tenant-primary / --tenant-secondary.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { generateTenantCssVars } from "@/lib/tenant-runtime/theme";
 *   import { resolveTenantBranding } from "@/lib/tenant-runtime/branding";
 *
 *   // In a server component:
 *   const branding = resolveTenantBranding(ctx);
 *   const cssVars = generateTenantCssVars(branding);
 *   // <div style={cssVars as React.CSSProperties}>
 *
 * ─── Client safety ──────────────────────────────────────────────────────────
 *
 * This module is pure — no prisma, no next/headers, no next/server.
 * Safe to import from client components.
 */

import {
  resolveTenantBranding,
  type TenantBrandingConfig,
} from "./branding";

// ── CSS variable names ────────────────────────────────────────────────────────

/**
 * Canonical CSS custom property names for tenant branding.
 * All references to tenant theme CSS variables must use these constants.
 */
export const TENANT_CSS_VARS = {
  primary: "--tenant-primary",
  secondary: "--tenant-secondary",
} as const;

export type TenantCssVarName = (typeof TENANT_CSS_VARS)[keyof typeof TENANT_CSS_VARS];

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generates a CSS custom property map from tenant branding config.
 *
 * Accepts a TenantBrandingConfig (with nullable fields) or null/undefined.
 * Falls back to PLATFORM_BRANDING via resolveTenantBranding() for any nulls.
 *
 * Returns a plain Record<string, string> suitable for:
 *   • React inline style prop: `style={vars as React.CSSProperties}`
 *   • CSS string via tenantCssVarString()
 *
 * @example
 *   const vars = generateTenantCssVars(ctx);
 *   // { "--tenant-primary": "#0b4aa2", "--tenant-secondary": "#c7332c" }
 */
export function generateTenantCssVars(
  cfg: TenantBrandingConfig | null | undefined,
): Record<string, string> {
  const resolved = resolveTenantBranding(cfg);
  return {
    [TENANT_CSS_VARS.primary]: resolved.primaryColor,
    [TENANT_CSS_VARS.secondary]: resolved.secondaryColor,
  };
}

/**
 * Serialises the CSS variable map as a semicolon-delimited inline style string.
 *
 * Useful when you need to inject vars into a raw style attribute or a
 * server-rendered <style> block.
 *
 * @example
 *   tenantCssVarString(ctx)
 *   // "--tenant-primary:#0b4aa2;--tenant-secondary:#c7332c"
 */
export function tenantCssVarString(
  cfg: TenantBrandingConfig | null | undefined,
): string {
  const vars = generateTenantCssVars(cfg);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
