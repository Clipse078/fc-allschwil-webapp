/**
 * lib/tenants/resolve-from-request.ts
 *
 * Resolves the active tenant from an incoming HTTP request.
 * Replaces the scattered `getDefaultTenant()` calls in public API routes
 * to enable multi-tenant public surfaces.
 *
 * Resolution order (first match wins):
 *  1. X-Tenant-Slug request header (explicit API client identification)
 *  2. ?tenant= query param (local dev / testing convenience)
 *  3. Subdomain of the Host header (e.g. "fc-allschwil.example.com" → "fc-allschwil")
 *  4. DEFAULT_TENANT_KEY fallback ("fc-allschwil") — single-tenant kiosk/website setup
 */

import type { NextRequest } from "next/server";
import { getTenantByKey, getDefaultTenant } from "@/lib/tenants/queries";

/**
 * Subdomains that are NOT tenant keys — infrastructure/platform prefixes.
 */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "stage",
  "localhost",
  "app",
  "admin",
  "api",
  "webapp",
  "stage-webapp",
]);

export async function resolveTenantFromRequest(request: NextRequest) {
  // 1. Explicit header
  const headerSlug = request.headers.get("x-tenant-slug");
  if (headerSlug) {
    const tenant = await getTenantByKey(headerSlug.trim().toLowerCase());
    if (tenant) return tenant;
  }

  // 2. Query param
  const { searchParams } = new URL(request.url);
  const paramSlug = searchParams.get("tenant");
  if (paramSlug) {
    const tenant = await getTenantByKey(paramSlug.trim().toLowerCase());
    if (tenant) return tenant;
  }

  // 3. Subdomain of Host header
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (!RESERVED_SUBDOMAINS.has(subdomain)) {
      const tenant = await getTenantByKey(subdomain);
      if (tenant) return tenant;
    }
  }

  // 4. Default fallback
  return getDefaultTenant();
}
