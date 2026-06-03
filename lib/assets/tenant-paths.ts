/**
 * Canonical Tenant Asset Path / Key Helpers — Slice 10.10
 *
 * Single source of truth for tenant-scoped asset key and public URL
 * construction. No call site builds paths directly — import from here.
 *
 * ─── Storage-adapter-ready, not runtime-write-ready ──────────────────────────
 *
 * These helpers define the naming convention for tenant assets so that a
 * future persistent storage adapter (Vercel Blob, S3-compatible, etc.) has
 * a canonical key format to write to and read from.
 *
 * What is NOT here (intentionally):
 *   - No fs.writeFile / fs.mkdir calls.
 *   - No runtime writes to public/. Writing to public/ at runtime is not
 *     persistent on Vercel or any read-only / ephemeral filesystem deployment.
 *     The physical upload implementation belongs in Slice 10.11
 *     (Persistent Logo Storage Adapter).
 *
 * ─── Convention ──────────────────────────────────────────────────────────────
 *
 *   Storage key:  logos/{tenantKey}.{ext}
 *   Public URL:   /images/logos/{tenantKey}.{ext}   (local dev / CDN prefix)
 *
 * One key per tenant per extension — uploading a new file always overwrites
 * the same key, guaranteeing no orphaned duplicates by construction.
 */

/**
 * Returns the storage object key for a tenant logo.
 * Used as the key/path within a storage bucket or CDN namespace.
 *
 * Example: getTenantLogoKey("fc-allschwil", "png") → "logos/fc-allschwil.png"
 */
export function getTenantLogoKey(tenantKey: string, ext: string): string {
  return `logos/${tenantKey}.${ext}`;
}

/**
 * Returns the public URL path for a tenant logo served from the app's
 * static asset base (or a CDN origin that mirrors the same convention).
 *
 * Suitable as Tenant.logoUrl — passes isValidLogoUrl() (root-relative path).
 *
 * Example: getTenantLogoPublicPath("fc-allschwil", "png")
 *          → "/images/logos/fc-allschwil.png"
 */
export function getTenantLogoPublicPath(tenantKey: string, ext: string): string {
  return `/images/logos/${tenantKey}.${ext}`;
}
