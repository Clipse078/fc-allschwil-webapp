/**
 * lib/registrations/coordinator-queries.ts
 *
 * REG-WAIT-01D / REG-WAIT-01F — Eligible registration / waiting-list coordinator lookup.
 *
 * Returns tenant members whose effective role grants registrations.edit.
 * Excludes service-only accounts that hold the permission exclusively via
 * isSystem tenant roles (e.g. bootstrap Club Admin identities) unless the
 * user is linked to a real Person record.
 */

import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireTenant } from "@/lib/tenants/require-tenant";
import type { AssignableUser } from "./workflow-types";

const COORDINATOR_PERMISSION_KEYS = [PERMISSIONS.REGISTRATIONS_EDIT] as const;

type CoordinatorCandidate = AssignableUser & {
  hasPersonLink: boolean;
  hasNonSystemPermissionRole: boolean;
};

export function isOperationalRegistrationCoordinator(candidate: {
  hasPersonLink: boolean;
  hasNonSystemPermissionRole: boolean;
}): boolean {
  return candidate.hasPersonLink || candidate.hasNonSystemPermissionRole;
}

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
          person: {
            where: { tenantId: tenant.id },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
          userRoles: {
            where: {
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
            select: {
              role: {
                select: { isSystem: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  const seen = new Set<string>();
  const coordinators: AssignableUser[] = [];

  for (const membership of memberships) {
    const user = membership.user;
    if (seen.has(user.id)) continue;

    const candidate: CoordinatorCandidate = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      hasPersonLink: !!user.person,
      hasNonSystemPermissionRole: user.userRoles.some((assignment) => !assignment.role.isSystem),
    };

    if (!isOperationalRegistrationCoordinator(candidate)) continue;

    seen.add(user.id);
    coordinators.push(toOperationalCoordinatorDisplay(user));
  }

  return coordinators;
}

function toOperationalCoordinatorDisplay(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  person: {
    firstName: string;
    lastName: string;
    displayName: string | null;
  } | null;
}): AssignableUser {
  if (user.person) {
    if (user.person.displayName?.trim()) {
      const parts = user.person.displayName.trim().split(/\s+/);
      const firstName = parts[0] ?? user.person.firstName;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : user.person.lastName;
      return { id: user.id, firstName, lastName, email: user.email };
    }

    return {
      id: user.id,
      firstName: user.person.firstName,
      lastName: user.person.lastName,
      email: user.email,
    };
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
}
