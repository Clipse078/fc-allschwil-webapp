/**
 * lib/infoboard/kiosk-tenant.ts
 *
 * Tenant resolution for public Infoboard kiosk routes.
 *
 * Public kiosk routes (/infoboard/[slug], /infoboard/screen-1) are not
 * authenticated — tenant context cannot come from a session. Resolution
 * order:
 *
 *   1. KIOSK_DEFAULT_TENANT_KEY env var — allows per-deployment overrides
 *      without code changes (e.g. staging, white-label deployments).
 *   2. DEFAULT_TENANT_KEY from lib/tenants/queries — the platform-wide
 *      fallback ("fc-allschwil" for the current single-tenant deployment).
 *
 * Extension point: when subdomain/custom-domain → tenant routing is
 * introduced, call resolveKioskTenantKey(hostname) from the page component
 * and pass the result here. No other code needs to change.
 *
 * Design constraints:
 *   - No Prisma access — callers do their own DB lookup after resolution.
 *   - No auth, no session.
 *   - Pure string → string mapping; callers decide what to do with null.
 */

import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";

/**
 * Resolves the tenant key to use for an unauthenticated kiosk request.
 *
 * Returns the first non-empty value from:
 *   1. `KIOSK_DEFAULT_TENANT_KEY` environment variable
 *   2. `DEFAULT_TENANT_KEY` platform constant
 *
 * Future: accept a `hostname` parameter and look up the tenant mapping table.
 */
export function resolveKioskTenantKey(): string {
  const envKey = process.env.KIOSK_DEFAULT_TENANT_KEY?.trim();
  if (envKey) return envKey;
  return DEFAULT_TENANT_KEY;
}
