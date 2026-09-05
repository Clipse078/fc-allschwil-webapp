/**
 * /api/users/[userId]/roles — PLATFORM-scoped role assignment ONLY.
 *
 * RPERM-05-C1 (Finding 3): this endpoint predates RPERM-05 and previously
 * accepted broad role replacement — deleting every UserRole row for the
 * user across all tenants, recreating from submitted ids, and silently
 * upserting a TenantMembership for any TENANT-scoped role in the request.
 * That bypassed every RPERM-05 tenant safeguard (active-membership check,
 * tenant isolation, protected-role rules, last-active-Club-Admin
 * safeguard) and could unintentionally affect multiple tenants at once.
 *
 * Corrected scope:
 *   GET → returns only this user's PLATFORM-scoped role ids.
 *   PUT → replaces only this user's PLATFORM-scoped UserRole rows.
 *         - Rejects (400) if any submitted id resolves to a TENANT role,
 *           an archived role, or a template role — no partial persist.
 *         - Never creates, updates, or reads a TenantMembership row.
 *         - Never touches a UserRole row with tenantId IS NOT NULL.
 *         - Idempotent; wrapped in a transaction when it writes.
 *
 * Tenant role assignments MUST go through the RPERM-05 tenant-scoped APIs
 * (`/api/tenant/roles/[id]/members`), which already enforce active
 * TenantMembership, tenant isolation, and protected-role rules. A future
 * platform support capability for tenant assignment is out of scope here
 * (deferred to PLATFORM-TENANT-01) — see lib/roles/platform-mutations.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePlatformApiPermission } from "@/lib/permissions/require-platform-api-permission";
import { setPlatformUserRoles } from "@/lib/roles/platform-mutations";
import { toRoleApiErrorResponse } from "@/lib/roles/errors";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      // RPERM-05-C1: PLATFORM-scope guard — tenant role ids are never
      // returned here; the platform user form must never even display
      // them as editable options.
      userRoles: {
        where: { role: { scope: "PLATFORM" } },
        select: { roleId: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    roleIds: user.userRoles.map((userRole) => userRole.roleId),
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const access = await requirePlatformApiPermission(PERMISSIONS.USERS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { userId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const roleIds = Array.isArray(body.roleIds)
    ? body.roleIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  try {
    const result = await setPlatformUserRoles({
      userId,
      roleIds,
      actorUserId: access.session?.user?.id,
    });

    return NextResponse.json({
      message: "Rollen erfolgreich gespeichert.",
      roleIds: result.roleIds,
    });
  } catch (error) {
    const { status, body: errorBody } = toRoleApiErrorResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
