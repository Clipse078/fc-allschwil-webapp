import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenantId } from "@/lib/tenants/active-tenant";
import {
  getPersonsForDirectory,
  getOrgUnitsForTenant,
  getTeamsForTenant,
  getActiveSeasonForTenant,
} from "@/lib/people/queries";
import { createEffectivePermissionResolver } from "@/lib/permissions/services/effective-permission-resolver";
import { prisma } from "@/lib/db/prisma";
import PersonsPageClient from "@/components/admin/persons/PersonsPageClient";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

export default async function PersonsPage() {
  const session = await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const tenantId = await getActiveTenantId();

  const [persons, orgUnits, teams, activeSeason] = await Promise.all([
    tenantId ? getPersonsForDirectory(tenantId) : Promise.resolve([]),
    tenantId ? getOrgUnitsForTenant(tenantId) : Promise.resolve([]),
    tenantId ? getTeamsForTenant(tenantId) : Promise.resolve([]),
    tenantId ? getActiveSeasonForTenant(tenantId) : Promise.resolve(null),
  ]);

  const orgUnitOptions = orgUnits.map((ou) => ({ id: ou.id, name: ou.name }));
  const teamOptions = teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    orgUnitIds: [
      t.orgUnitId ?? "",
      ...t.teamSeasons.flatMap((ts) => ts.orgUnits.map((o) => o.orgUnitId)),
    ].filter(Boolean),
  }));

  let canDelete = false;
  if (tenantId) {
    const resolver = createEffectivePermissionResolver(prisma);
    canDelete = await resolver.hasTenantDeletionAuthority({
      userId: session.user.id,
      permission: PERMISSIONS.PEOPLE_DELETE,
      tenantId,
    });
  }

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Organisation"
        title="Personen"
        description="Alle Personen des Vereins zentral verwalten und Organisation, Teams und Funktionen zuordnen."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Personen" },
        ]}
        headerActions={
          <PersonsPageClient
            persons={persons}
            orgUnits={orgUnitOptions}
            teams={teamOptions}
            activeSeason={activeSeason}
            canDelete={canDelete}
            ctaOnly
          />
        }
      >
        <PersonsPageClient
          persons={persons}
          orgUnits={orgUnitOptions}
          teams={teamOptions}
          activeSeason={activeSeason}
          canDelete={canDelete}
        />
      </ListPagePattern>
    </PageShell>
  );
}
