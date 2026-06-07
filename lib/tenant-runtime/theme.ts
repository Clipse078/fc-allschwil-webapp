/**
 * Canonical Tenant Runtime Theme — Sprint 4: Tenant Branding System
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
 * - Does NOT touch the global --blue / --red / --sce-* / --color-brand-* tokens.
 *   Those are fixed SportClubEvo UX tokens defined in globals.css and unchanged.
 * - Does NOT import from prisma or next/server — client-safe.
 *
 * ─── CSS variable namespace ──────────────────────────────────────────────────
 *
 *   --tenant-primary    Primary brand color (hex). Directly set from DB.
 *   --tenant-secondary  Secondary/accent brand color (hex). Directly set from DB.
 *   --tenant-accent     Light tint of primary for subtle surface accents.
 *                       Auto-derived in CSS via color-mix(); NOT set in JS.
 *                       See globals.css :root for the derivation rule.
 *
 * These vars are additive: existing components continue using --blue / --red.
 * All tenant-branded surfaces use ONLY these three vars — no inline hex values.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { generateTenantCssVars } from "@/lib/tenant-runtime/theme";
 *
 *   // In a server component:
 *   const cssVars = generateTenantCssVars(ctx);
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
 *
 * --tenant-accent is intentionally absent: it is CSS-derived from
 * --tenant-primary via color-mix() in globals.css and requires no JS value.
 */
export const TENANT_CSS_VARS = {
  primary:   "--tenant-primary",
  secondary: "--tenant-secondary",
  /** Derived in CSS: color-mix(in srgb, var(--tenant-primary) 10%, white) */
  accent:    "--tenant-accent",
} as const;

export type TenantCssVarName = (typeof TENANT_CSS_VARS)[keyof typeof TENANT_CSS_VARS];

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generates a CSS custom property map from tenant branding config.
 *
 * Sets --tenant-primary and --tenant-secondary from the resolved branding.
 * --tenant-accent is NOT emitted here — it is computed by the CSS engine
 * automatically via the color-mix() rule in globals.css :root.
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
    [TENANT_CSS_VARS.primary]:   resolved.primaryColor,
    [TENANT_CSS_VARS.secondary]: resolved.secondaryColor,
  };
}

