/**
 * lib/infoboard/kiosk-tenant.ts
 *
 * Tenant resolution for public Infoboard kiosk page routes.
 *
 * Public kiosk pages (/infoboard/[slug], /infoboard/screen-1) are not
 * authenticated — tenant context cannot come from a session. This module
 * provides the canonical resolution chain for those routes.
 *
 * Resolution order (mirrors the pattern used by resolveTenantFromRequest
 * in lib/website/response-helpers.ts for API routes):
 *
 *   1. Subdomain of the Host request header
 *      e.g. "fc-allschwil" from "fc-allschwil.sportclubevo.com"
 *      Skipped for localhost, bare IPs, single-segment hostnames.
 *   2. KIOSK_DEFAULT_TENANT_KEY env var — per-deployment override.
 *   3. DEFAULT_TENANT_KEY — platform constant, local/dev fallback.
 *
 * The same slug ("screen-1") resolves correctly for different tenants
 * because lookups are always scoped to (tenantId, slug).
 *
 * Extension point: when a domain→tenant mapping table is introduced,
 * replace step 1 with a DB lookup keyed on the full hostname instead
 * of the subdomain. No other code changes are needed.
 *
 * Design constraints:
 *   - No cross-tenant leakage: DB lookups are always tenant-scoped.
 *   - No auth, no session.
 *   - `extractSubdomainTenantKey` is pure and fully unit-testable.
 *   - `resolveKioskTenant` uses next/headers only at the boundary;
 *     the rest of the logic delegates to `resolveKioskTenantForHostname`
 *     so it can be tested without mocking Next.js internals.
 */

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";

// ── Kiosk tenant shape ────────────────────────────────────────────────────────

const KIOSK_TENANT_SELECT = {
  id: true,
  key: true,
  name: true,
  timezone: true,
  logoUrl: true,
  infoboardDisplayTheme: true,
} as const;

export type KioskTenant = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly timezone: string | null;
  readonly logoUrl: string | null;
  readonly infoboardDisplayTheme: string | null;
};

// ── Pure hostname helper ──────────────────────────────────────────────────────

/**
 * Extracts a tenant key candidate from a hostname using the first subdomain
 * segment. Returns null for hostnames where no meaningful subdomain exists.
 *
 * Examples:
 *   "fc-allschwil.sportclubevo.com"  → "fc-allschwil"
 *   "localhost"                       → null
 *   "localhost:3000"                  → null
 *   "192.168.1.1"                     → null
 *   "sportclubevo.com"               → null  (no subdomain)
 *   "www.sportclubevo.com"           → null  (www skipped)
 *   "other.fc-allschwil.example.com" → "other"
 *
 * This is a pure function — no DB access, fully unit-testable.
 */
export function extractSubdomainTenantKey(hostname: string): string | null {
  // Strip port if present
  const host = hostname.split(":")[0].toLowerCase().trim();

  // Skip empty, localhost, and bare IP addresses
  if (!host || host === "localhost") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null; // IPv4
  if (host.startsWith("[")) return null; // IPv6

  const parts = host.split(".");

  // Must have at least three segments (subdomain.domain.tld).
  // A two-segment hostname like "sportclubevo.com" has no subdomain.
  if (parts.length < 3) return null;

  const subdomain = parts[0];

  // Skip generic/infrastructure subdomains
  if (!subdomain || subdomain === "www") return null;

  return subdomain;
}

// ── DB resolver (testable: accepts explicit hostname) ─────────────────────────

/**
 * Resolves the ACTIVE kiosk tenant for a given request hostname.
 *
 * Attempts subdomain-based resolution first; falls back through
 * KIOSK_DEFAULT_TENANT_KEY and DEFAULT_TENANT_KEY.
 *
 * Returns null when no ACTIVE tenant can be resolved. Callers must
 * call notFound() in that case.
 *
 * This overload accepts an explicit hostname so it can be called from tests
 * and from resolveKioskTenant() without duplicating logic.
 */
export async function resolveKioskTenantForHostname(
  hostname: string,
): Promise<KioskTenant | null> {
  const subdomainKey = extractSubdomainTenantKey(hostname);

  if (subdomainKey) {
    const tenant = await prisma.tenant.findFirst({
      where: { key: subdomainKey, status: "ACTIVE" },
      select: KIOSK_TENANT_SELECT,
    });
    if (tenant) return tenant as KioskTenant;
  }

  // Env var or platform default fallback
  const fallbackKey =
    process.env.KIOSK_DEFAULT_TENANT_KEY?.trim() || DEFAULT_TENANT_KEY;

  const fallback = await prisma.tenant.findFirst({
    where: { key: fallbackKey, status: "ACTIVE" },
    select: KIOSK_TENANT_SELECT,
  });
  return (fallback as KioskTenant | null) ?? null;
}

// ── Request boundary (uses next/headers) ──────────────────────────────────────

/**
 * Resolves the ACTIVE kiosk tenant from the current request's Host header.
 * Use this in server component page routes.
 *
 * Returns null when no ACTIVE tenant is found. Callers must return notFound().
 */
export async function resolveKioskTenant(): Promise<KioskTenant | null> {
  const host = (await headers()).get("host") ?? "";
  return resolveKioskTenantForHostname(host);
}
