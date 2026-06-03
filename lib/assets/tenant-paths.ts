/**
 * Canonical Tenant Asset Path Helpers — Slice 10.10
 *
 * Single source of truth for tenant-scoped asset path construction.
 * No call site builds its own path — import from here.
 *
 * ─── Storage approach ────────────────────────────────────────────────────────
 *
 * Current: local filesystem under public/images/logos/{tenantKey}.{ext}
 * Rationale: zero external dependencies for the initial foundation; consistent
 * with the existing public/images/logos/fc-allschwil.png convention.
 *
 * Future: swap getTenantLogoAbsolutePath / getTenantLogoPublicPath for a
 * cloud-storage adapter (Vercel Blob, S3) without touching call sites.
 *
 * ─── Convention ──────────────────────────────────────────────────────────────
 *
 *   Disk:   <cwd>/public/images/logos/{tenantKey}.{ext}
 *   Public: /images/logos/{tenantKey}.{ext}
 *
 * One file per tenant per extension — uploading a new file overwrites the old
 * one, guaranteeing no duplicates by construction.
 */

import path from "path";

/**
 * Returns the public URL path for a tenant logo.
 * Suitable as Tenant.logoUrl value — works with isValidLogoUrl() (root-relative).
 */
export function getTenantLogoPublicPath(tenantKey: string, ext: string): string {
  return `/images/logos/${tenantKey}.${ext}`;
}

/**
 * Returns the absolute filesystem path for writing a tenant logo under public/.
 * Server-side only (Node.js). Do not import on the client.
 */
export function getTenantLogoAbsolutePath(tenantKey: string, ext: string): string {
  return path.join(process.cwd(), "public", "images", "logos", `${tenantKey}.${ext}`);
}

/**
 * Returns the public directory that holds tenant logos.
 * Used to ensure the directory exists before writing.
 */
export function getTenantLogosDir(): string {
  return path.join(process.cwd(), "public", "images", "logos");
}
