/**
 * lib/communication/mention-candidates.ts
 *
 * COMM-01B: Tenant-scoped @mention candidate search.
 *
 * Eligibility: active User + active TenantMembership in the same tenant.
 * Uses registrations.view / registrations.edit visibility (temporary mapping
 * until dedicated communication permissions exist).
 */

import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { filterCoordinatorsBySearch } from "@/lib/registrations/coordinator-search";
import type { AssignableUser } from "@/lib/registrations/workflow-types";

const MENTION_PERMISSION_KEYS = [
  PERMISSIONS.REGISTRATIONS_VIEW,
  PERMISSIONS.REGISTRATIONS_EDIT,
] as const;

function toMentionCandidateDisplay(user: {
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
  if (user.person?.displayName?.trim()) {
    const parts = user.person.displayName.trim().split(/\s+/);
    const firstName = parts[0] ?? user.person.firstName;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : user.person.lastName;
    return { id: user.id, firstName, lastName, email: user.email };
  }

  if (user.person) {
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

export async function listMentionCandidatesForTenant(
  tenantSlug: string,
  query = "",
): Promise<AssignableUser[]> {
  const tenant = await requireTenant(tenantSlug);

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      tenant: { status: "ACTIVE" },
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
                    key: { in: [...MENTION_PERMISSION_KEYS] },
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
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  const seen = new Set<string>();
  const candidates: AssignableUser[] = [];

  for (const membership of memberships) {
    const user = membership.user;
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    candidates.push(toMentionCandidateDisplay(user));
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 1) {
    return candidates.slice(0, 12);
  }

  if (trimmedQuery.length < 2) {
    return candidates
      .filter((user) => {
        const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
        return haystack.includes(trimmedQuery.toLowerCase());
      })
      .slice(0, 12);
  }

  return filterCoordinatorsBySearch(candidates, trimmedQuery, 12);
}
