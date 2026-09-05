/**
 * GET /api/users/select
 *
 * Lightweight user list for allowlist pickers (VisibleUsersSelect).
 * Returns only { id, name, email } for active users with an active membership
 * in the caller's active tenant.
 *
 * Auth: tenant-local selector access is available to user-directory readers
 * and the management workflows that use this picker.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiTenantPermissionContext } from "@/lib/permissions/require-api-tenant-context";

export async function GET() {
  const access = await requireApiTenantPermissionContext([
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.MEETINGS_MANAGE,
    PERMISSIONS.TARGETS_MANAGE,
    PERMISSIONS.INITIATIVES_MANAGE,
  ]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId: access.context.tenantId,
      isActive: true,
      user: { isActive: true },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(
    memberships.map(({ user: u }) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
    })),
  );
}
