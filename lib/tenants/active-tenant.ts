/**
 * RPERM-04 — Single Tenant-Resolution Helper
 *
 * The one and only way server-side code should obtain the current tenant
 * context. Never read `session.user.activeTenantId` (or the removed legacy
 * `session.user.tenantId`) directly outside of this module — always go
 * through `getActiveTenant()` / `requireTenantContext()` (full context) or
 * `getActiveTenantId()` / `requireActiveTenantId()` (id only, no extra query).
 *
 * The underlying tenant context itself is derived from the user's active
 * TenantMembership at sign-in (see lib/auth/session-context.ts) — never from
 * the legacy `User.tenantId` column.
 *
 * Usage in a Server Component / page:
 *   const tenant = await requireTenantContext();
 *
 * Usage in an API route (after requireApiPermission):
 *   const tenantId = access.session.user.activeTenantId;
 *   // or, equivalently and preferred for new code:
 *   const tenantId = await requireApiActiveTenantId();
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getCurrentTenantContextById,
  type TenantContext,
} from "@/lib/tenants/context";

/** Returns the current session's active tenant id, or null if none. No DB query. */
export async function getActiveTenantId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.activeTenantId ?? null;
}

/**
 * Returns the current session's active tenant id.
 * Redirects to /dashboard when the session has no active tenant context —
 * for use in Server Components / pages only (calls next/navigation redirect).
 */
export async function requireActiveTenantId(): Promise<string> {
  const tenantId = await getActiveTenantId();
  if (!tenantId) {
    redirect("/dashboard");
  }
  return tenantId;
}

/** Returns the full TenantContext for the session's active tenant, or null. */
export async function getActiveTenant(): Promise<TenantContext | null> {
  const tenantId = await getActiveTenantId();
  if (!tenantId) return null;
  return getCurrentTenantContextById(tenantId);
}

/**
 * Returns the full TenantContext for the session's active tenant.
 * Redirects to /dashboard when there is no active tenant context —
 * for use in Server Components / pages only.
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const tenant = await getActiveTenant();
  if (!tenant) {
    redirect("/dashboard");
  }
  return tenant;
}

/**
 * API-route-safe variant: returns a discriminated result instead of calling
 * `redirect()` (which is only valid in Server Components / pages, not route
 * handlers). Use after requireApiPermission()/requireApiAnyPermission():
 *
 *   const access = await requireApiPermission(PERMISSIONS.EVENTS_MANAGE);
 *   if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
 *   const tenantResult = await requireApiActiveTenantId();
 *   if (!tenantResult.ok) return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
 *   const { tenantId } = tenantResult;
 */
export async function requireApiActiveTenantId(): Promise<
  | { ok: true; tenantId: string }
  | { ok: false; status: 403; error: string }
> {
  const tenantId = await getActiveTenantId();
  if (!tenantId) {
    return { ok: false, status: 403, error: "Kein Mandanten-Kontext." };
  }
  return { ok: true, tenantId };
}
