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
 *
 * ── RPERM-04-C1: route-tenant-slug resolution ────────────────────────────────
 * Routes identified by a URL route parameter (e.g. `/tenant/[tenantSlug]/...`)
 * must NEVER authorize against `session.user.activeTenantId` — that is the
 * user's OWN default tenant and may have nothing to do with the tenant named
 * in the URL. Use `requireTenantContextForSlug()` (pages) or
 * `requireApiTenantContextForSlug()` (API routes) instead: both resolve the
 * tenant strictly from the `tenantSlug` route param and verify the current
 * user holds an active membership in that EXACT tenant before returning it.
 * Callers must then pass the returned `tenantId` explicitly into
 * `requirePermission()`/`requireApiPermission()` (etc.) — never omit it and
 * let those helpers fall back to `activeTenantId` when a tenant slug is
 * present in the route.
 *
 * Usage in a tenant-slug Server Component / page:
 *   const tenantContext = await requireTenantContextForSlug(tenantSlug);
 *   const session = await requireAnyPermission([...], tenantContext.id);
 *
 * Usage in a tenant-slug API route:
 *   const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
 *   if (!tenantResult.ok) return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
 *   const access = await requireApiAnyPermission([...], tenantResult.tenantId);
 *   if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import {
  getCurrentTenantContext,
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

// ── RPERM-04-C1: Route Tenant-Slug Resolution ───────────────────────────────
//
// Canonical resolver for any route whose tenant is identified by a URL
// parameter (tenantSlug) rather than by the caller's own session tenant.
// This is the fix for the "registration route authorizes against wrong
// tenant" finding: a user's session.activeTenantId must never be used to
// authorize a request for a DIFFERENT tenant named in the URL.

export type SlugTenantContext = TenantContext & { membershipId: string };

/**
 * Resolves the tenant identified by `tenantSlug` for the CURRENT session
 * user. Returns null unless ALL of the following hold:
 *   - the tenant exists and is operationally ACTIVE (not ARCHIVED/INACTIVE);
 *   - the current user has an active TenantMembership in that EXACT tenant.
 *
 * Never falls back to `session.user.activeTenantId` — the returned tenant
 * (if any) is always the one named by `tenantSlug`, resolved fresh against
 * the database on every call (no JWT-cached shortcuts), so a membership
 * deactivation or tenant archival takes effect on the very next request.
 */
export async function getTenantContextForSlug(
  tenantSlug: string,
): Promise<SlugTenantContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return resolveTenantContextForSlugAndUser(userId, tenantSlug);
}

async function resolveTenantContextForSlugAndUser(
  userId: string,
  tenantSlug: string,
): Promise<SlugTenantContext | null> {
  if (!tenantSlug) return null;

  // getCurrentTenantContext() already filters status: "ACTIVE" — an
  // archived or inactive tenant simply does not resolve here.
  const tenant = await getCurrentTenantContext(tenantSlug);
  if (!tenant) return null;

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: tenant.id, userId, isActive: true },
    select: { id: true },
  });
  if (!membership) return null;

  return { ...tenant, membershipId: membership.id };
}

/**
 * Server Component / page variant of `getTenantContextForSlug()`.
 * Redirects to /dashboard — before any tenant data is fetched — when the
 * tenant does not exist, is not ACTIVE, or the current user has no active
 * membership in it.
 */
export async function requireTenantContextForSlug(
  tenantSlug: string,
): Promise<SlugTenantContext> {
  const tenant = await getTenantContextForSlug(tenantSlug);
  if (!tenant) {
    redirect("/dashboard");
  }
  return tenant;
}

/**
 * API-route-safe variant: returns a discriminated result instead of calling
 * `redirect()`. Call this FIRST, before requireApiPermission()/
 * requireApiAnyPermission() and before any tenant data is queried, so an
 * invalid tenantSlug (unknown, archived, or no membership) is rejected
 * before any registration/tenant data is ever retrieved:
 *
 *   const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
 *   if (!tenantResult.ok) return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
 *   const access = await requireApiAnyPermission([...], tenantResult.tenantId);
 *   if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
 */
export async function requireApiTenantContextForSlug(
  tenantSlug: string,
): Promise<
  | { ok: true; tenantId: string; tenant: SlugTenantContext }
  | { ok: false; status: 401 | 404; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const tenant = await resolveTenantContextForSlugAndUser(userId, tenantSlug);
  if (!tenant) {
    return { ok: false, status: 404, error: "Tenant nicht gefunden." };
  }

  return { ok: true, tenantId: tenant.id, tenant };
}
