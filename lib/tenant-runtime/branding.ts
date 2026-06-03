/**
 * Canonical Tenant Runtime Branding — Slice 10.6
 *
 * Single source of truth for tenant-configurable branding.
 * Defines the branding config type, SportClubEvo platform defaults,
 * and the resolver that applies fallbacks to a raw tenant record.
 *
 * ─── Principles ─────────────────────────────────────────────────────────────
 *
 * - Branding is configurable, UX is not.
 * - All branding reads must go through resolveTenantBranding().
 * - No inline tenant color calculations elsewhere in the codebase.
 * - No duplicate color helpers or hardcoded hex values outside this file.
 *
 * ─── Surfaces ───────────────────────────────────────────────────────────────
 *
 * The same primaryColor / secondaryColor is used across all branding surfaces
 * (login, email, website, InfoBoard, admin cockpit). Surface-specific overrides
 * are not required at this foundation stage.
 *
 * ─── CSS variables ──────────────────────────────────────────────────────────
 *
 * See lib/tenant-runtime/theme.ts for CSS variable generation.
 * CSS vars produced:  --tenant-primary  --tenant-secondary
 *
 * ─── Client safety ──────────────────────────────────────────────────────────
 *
 * This module is pure data transformation — no prisma, no next/headers,
 * no next/server. Safe to import from client components.
 */

// ── Config type ───────────────────────────────────────────────────────────────

/**
 * Raw tenant branding fields as stored in the database.
 * All fields are nullable: the application applies platform defaults via
 * resolveTenantBranding() before any rendering or injection.
 */
export type TenantBrandingConfig = {
  /** URL or relative path to the club/tenant logo. Null = no logo configured. */
  logoUrl: string | null;
  /** Primary brand color as a 6-digit hex string: "#rrggbb". Null = use platform default. */
  primaryColor: string | null;
  /** Secondary/accent brand color as a 6-digit hex string: "#rrggbb". Null = use platform default. */
  secondaryColor: string | null;
};

// ── Resolved type ─────────────────────────────────────────────────────────────

/**
 * Branding with all color fields guaranteed non-null.
 * logoUrl may still be null (no logo is valid configuration).
 * Produced exclusively by resolveTenantBranding().
 */
export type ResolvedBranding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

// ── Platform defaults (SportClubEvo) ─────────────────────────────────────────

/**
 * SportClubEvo platform defaults.
 * Used when a tenant has not configured branding, ensuring the fixed
 * SportClubEvo UX remains stable and no UI breaks on null config.
 *
 * These are the ONLY place where SportClubEvo hex colors are permitted
 * as branding defaults. All other code reads from resolveTenantBranding().
 */
export const PLATFORM_BRANDING: Readonly<ResolvedBranding> = {
  logoUrl: null,
  primaryColor: "#0b4aa2",   // SportClubEvo brand blue (matches --color-brand-blue in globals.css)
  secondaryColor: "#c7332c", // SportClubEvo brand red  (matches --color-brand-red in globals.css)
};

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves tenant branding, applying PLATFORM_BRANDING defaults for any null fields.
 *
 * Pass the raw tenant object from the database (anything with the three branding
 * fields), a TenantBrandingConfig, or null/undefined for a fully-defaulted result.
 *
 * Returns a ResolvedBranding with primaryColor and secondaryColor guaranteed
 * non-null and ready for CSS variable injection.
 *
 * @example
 *   // Server component
 *   const ctx = await getCurrentTenantContext();
 *   const branding = resolveTenantBranding(ctx);
 *   const cssVars = generateTenantCssVars(branding);
 */
export function resolveTenantBranding(
  cfg: TenantBrandingConfig | null | undefined,
): ResolvedBranding {
  return {
    logoUrl: cfg?.logoUrl ?? PLATFORM_BRANDING.logoUrl,
    primaryColor: cfg?.primaryColor ?? PLATFORM_BRANDING.primaryColor,
    secondaryColor: cfg?.secondaryColor ?? PLATFORM_BRANDING.secondaryColor,
  };
}
