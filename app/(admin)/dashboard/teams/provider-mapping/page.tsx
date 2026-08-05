/**
 * /dashboard/teams/provider-mapping
 *
 * Admin overview for canonical provider team mappings.
 *
 * Shows all TeamExternalMapping rows for the active tenant with their
 * competition context, confidence level, and mapping status.
 *
 * TEAM-PROVIDER-01: Provider-neutral. SFV is the first adapter.
 * German UI. Server Component with client-side interactions.
 */

import { Link2, Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listProviderMappings } from "@/lib/provider-mapping/provider-mapping-queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import ProviderMappingTable from "@/components/admin/teams/provider-mapping/ProviderMappingTable";
import ProviderMappingFilters from "@/components/admin/teams/provider-mapping/ProviderMappingFilters";
import type { MappingFilterParams } from "@/lib/provider-mapping/provider-mapping-queries";
import Link from "next/link";

type PageProps = {
  searchParams?: Promise<{
    provider?: string;
    search?: string;
    mappingSource?: string;
    seasonId?: string;
  }>;
};

export default async function ProviderMappingPage({ searchParams }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const tenant = await getActiveTenant();
  const tenantId = tenant?.id;

  if (!tenantId) {
    return (
      <PageShell fullWidth>
        <div className="text-red-600 text-sm">Kein Mandanten-Kontext verfügbar.</div>
      </PageShell>
    );
  }

  const params = (await searchParams) ?? {};
  const filters: MappingFilterParams = {
    provider: params.provider ?? undefined,
    search: params.search ?? undefined,
    mappingSource: (params.mappingSource as MappingFilterParams["mappingSource"]) ?? undefined,
    seasonId: params.seasonId ?? undefined,
  };

  const mappings = await listProviderMappings(tenantId, filters);

  const canManage = session.user.permissionKeys?.includes(PERMISSIONS.TEAMS_MANAGE);

  const mappedCount = mappings.filter((m) => m.teamSeasonId !== null).length;
  const unmappedCount = mappings.filter((m) => m.teamSeasonId === null).length;

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Teams · Anbieter-Mapping"
        title="Anbieter-Zuordnungen"
        description="Ordnen Sie TeamSeason-Einträge externen Anbieter-Teams zu. Der Wettbewerb dient als Kontext — er besitzt die Zuordnung nicht."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Anbieter-Zuordnungen", href: "/dashboard/teams/provider-mapping" },
        ]}
        stats={
          <div className="flex gap-6 text-sm">
            <span>
              <span className="font-semibold text-green-700">{mappedCount}</span>
              <span className="ml-1 text-gray-500">zugeordnet</span>
            </span>
            <span>
              <span className="font-semibold text-gray-600">{unmappedCount}</span>
              <span className="ml-1 text-gray-500">nicht zugeordnet</span>
            </span>
            <span>
              <span className="font-semibold text-blue-700">{mappings.length}</span>
              <span className="ml-1 text-gray-500">gesamt</span>
            </span>
          </div>
        }
        headerActions={
          canManage ? (
            <Link
              href="/dashboard/teams/provider-mapping/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neue Zuordnung
            </Link>
          ) : undefined
        }
        toolbar={
          <ProviderMappingFilters
            currentProvider={params.provider}
            currentSearch={params.search}
            currentMappingSource={params.mappingSource}
          />
        }
        isEmpty={mappings.length === 0}
        emptyState={
          <div className="text-center py-16 text-gray-500">
            <Link2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Noch keine Anbieter-Zuordnungen</p>
            <p className="text-sm mt-1">Erstellen Sie die erste Zuordnung über &quot;Neue Zuordnung&quot;.</p>
          </div>
        }
      >
        <ProviderMappingTable
          mappings={mappings}
          canManage={canManage ?? false}
        />
      </ListPagePattern>
    </PageShell>
  );
}
