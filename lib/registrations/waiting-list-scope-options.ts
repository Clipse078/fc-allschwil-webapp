/**
 * lib/registrations/waiting-list-scope-options.ts
 *
 * REG-WAIT-01D — Tenant-scoped OrgUnit / TeamSeason options for waiting-list UX.
 */

import { prisma } from "@/lib/db/prisma";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { requireTenant } from "@/lib/tenants/require-tenant";
import type { OrgUnitOption, TeamSeasonOption } from "./workflow-types";

export async function getWaitingListScopeOptionsForTenant(tenantSlug: string): Promise<{
  orgUnits: OrgUnitOption[];
  teamSeasons: TeamSeasonOption[];
}> {
  const tenant = await requireTenant(tenantSlug);

  const [orgUnits, teamSeasonRows] = await Promise.all([
    prisma.orgUnit.findMany({
      where: {
        OR: [{ tenantId: tenant.id }, { tenantId: null }],
        status: "ACTIVE",
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        key: true,
        type: true,
        level: true,
      },
    }),
    findTeamSeasonsForTenant(tenant.id),
  ]);

  return {
    orgUnits,
    teamSeasons: teamSeasonRows.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      teamName: row.teamName,
      seasonName: row.seasonName,
    })),
  };
}
