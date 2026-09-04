/**
 * Human-readable effective-access summaries for People & Access UX.
 *
 * Groups permissions by canonical module labels — never exposes raw
 * permission keys to Club Admins in the default presentation.
 */

import { prisma } from "@/lib/db/prisma";
import { moduleLabel, moduleSortIndex, MODULE_DISPLAY_ORDER } from "@/lib/roles/module-labels";

export type EffectiveAccessModuleGroup = {
  module: string;
  moduleLabel: string;
  items: string[];
  hasAccess: boolean;
};

export function groupPermissionsByModule(
  rows: Array<{ name: string; module: string }>,
): EffectiveAccessModuleGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const items = groups.get(row.module) ?? new Set<string>();
    items.add(row.name);
    groups.set(row.module, items);
  }

  const withAccess = Array.from(groups.entries())
    .map(([module, items]) => ({
      module,
      moduleLabel: moduleLabel(module),
      items: Array.from(items).sort((a, b) => a.localeCompare(b, "de")),
      hasAccess: true,
    }))
    .sort((a, b) => moduleSortIndex(a.module) - moduleSortIndex(b.module));

  return withAccess;
}

/**
 * Preview effective access from a set of tenant role IDs (add-person review step).
 * Only TENANT-scoped, non-archived roles owned by `tenantId` contribute.
 */
export async function getEffectiveAccessSummaryFromRoleIds(
  tenantId: string,
  roleIds: string[],
): Promise<EffectiveAccessModuleGroup[]> {
  const deduped = Array.from(new Set(roleIds));
  if (deduped.length === 0) return [];

  const roles = await prisma.role.findMany({
    where: { id: { in: deduped }, scope: "TENANT", tenantId, isArchived: false },
    select: {
      rolePermissions: {
        select: {
          permission: {
            select: { name: true, module: true, grantableByAdmin: true, scope: true },
          },
        },
      },
    },
  });

  const rows: Array<{ name: string; module: string }> = [];
  for (const role of roles) {
    for (const rp of role.rolePermissions) {
      const p = rp.permission;
      if (p.scope === "TENANT" && p.grantableByAdmin) {
        rows.push({ name: p.name, module: String(p.module) });
      }
    }
  }

  return groupPermissionsByModule(rows);
}

/**
 * Effective access for an existing tenant member, derived from the resolver output.
 */
export async function getEffectiveAccessSummaryForUser(
  tenantId: string,
  userId: string,
): Promise<EffectiveAccessModuleGroup[]> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      user: {
        select: {
          userRoles: {
            where: { tenantId, role: { scope: "TENANT", tenantId, isArchived: false } },
            select: {
              role: {
                select: {
                  rolePermissions: {
                    select: {
                      permission: {
                        select: {
                          name: true,
                          module: true,
                          grantableByAdmin: true,
                          scope: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) return [];

  const rows: Array<{ name: string; module: string }> = [];
  for (const ur of membership.user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      const p = rp.permission;
      if (p.scope === "TENANT" && p.grantableByAdmin) {
        rows.push({ name: p.name, module: String(p.module) });
      }
    }
  }

  const withAccess = groupPermissionsByModule(rows);
  const coveredModules = new Set(withAccess.map((g) => g.module));

  // Surface major product areas without access for clarity (limited set).
  const majorModules = MODULE_DISPLAY_ORDER.filter((m) =>
    ["WEBSITE", "TRAININGS", "TEAMS", "NEWS", "WOCHENPLAN", "PEOPLE", "FACILITIES"].includes(m),
  );

  for (const moduleKey of majorModules) {
    if (!coveredModules.has(moduleKey)) {
      withAccess.push({
        module: moduleKey,
        moduleLabel: moduleLabel(moduleKey),
        items: [],
        hasAccess: false,
      });
    }
  }

  return withAccess.sort((a, b) => moduleSortIndex(a.module) - moduleSortIndex(b.module));
}
