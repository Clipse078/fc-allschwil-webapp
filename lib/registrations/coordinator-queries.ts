/**
 * lib/registrations/coordinator-queries.ts
 *
 * REG-WAIT-01D — Eligible registration / waiting-list coordinator lookup.
 *
 * Returns tenant members whose effective role grants registrations.edit.
 * Eligibility is derived from the permission architecture — never from
 * organisational labels or hardcoded role names.
 */

import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireTenant } from "@/lib/tenants/require-tenant";
import type { AssignableUser } from "./workflow-types";

const COORDINATOR_PERMISSION_KEYS = [PERMISSIONS.REGISTRATIONS_EDIT] as const;

export async function listEligibleRegistrationCoordinatorsForTenant(
  tenantSlug: string,
): Promise<AssignableUser[]> {
  const tenant = await requireTenant(tenantSlug);

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      user: {
        isActive: true,
        userRoles: {
          some: {
            tenantId: tenant.id,
            role: {
              scope: "TENANT",
              tenantId: tenant.id,
              isArchived: false,
              rolePermissions: {
                some: {
                  permission: {
                    key: { in: [...COORDINATOR_PERMISSION_KEYS] },
                    scope: "TENANT",
                  },
                },
              },
            },
          },
        },
      },
    },
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
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  const seen = new Set<string>();
  const coordinators: AssignableUser[] = [];

  for (const membership of memberships) {
    if (seen.has(membership.user.id)) continue;
    seen.add(membership.user.id);
    coordinators.push(membership.user);
  }

  return coordinators;
}
