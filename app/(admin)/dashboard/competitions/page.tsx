/**
 * /dashboard/competitions
 *
 * Admin overview of canonical Competition records.
 * Shows all competitions for the active tenant, with search, provider filter,
 * and archived toggle. Provides SFV sync trigger and manual creation for all
 * tenants — no provider required.
 *
 * German UI. Responsive. Server Component with client-side interactions.
 */

import { Trophy } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { listCompetitions } from "@/lib/competitions/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { PageShell, SectionCard } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import CompetitionsTable from "@/components/admin/competitions/CompetitionsTable";
import CompetitionsSyncButton from "@/components/admin/competitions/CompetitionsSyncButton";
import CompetitionsSearchBar from "@/components/admin/competitions/CompetitionsSearchBar";
import CompetitionsCreateButton from "@/components/admin/competitions/CompetitionsCreateButton";
import type { CompetitionFilterParams } from "@/lib/competitions/dto";

type CompetitionsPageProps = {
  searchParams?: Promise<{
    search?: string;
    provider?: string;
    externalSeasonId?: string;
    includeArchived?: string;
    competitionType?: string;
    gender?: string;
  }>;
};

export default async function CompetitionsPage({ searchParams }: CompetitionsPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.COMPETITIONS_VIEW,
    PERMISSIONS.COMPETITIONS_MANAGE,
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

  const filters: CompetitionFilterParams = {
    search: params.search,
    provider: params.provider,
    externalSeasonId: params.externalSeasonId
      ? parseInt(params.externalSeasonId, 10)
      : undefined,
    includeArchived: params.includeArchived === "true",
    competitionType: params.competitionType as CompetitionFilterParams["competitionType"],
    gender: params.gender as CompetitionFilterParams["gender"],
  };

  const competitions = await listCompetitions(tenantId, filters);

  const activeCount = competitions.filter((c) => !c.isArchived).length;
  const archivedCount = competitions.filter((c) => c.isArchived).length;

  const canManage = session.user.permissionKeys?.includes(PERMISSIONS.COMPETITIONS_MANAGE);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Wettkämpfe"
        title="Wettkämpfe"
        description="Ligen, Cups und Turnierserie — Wettkampfmetadaten für alle Saisons. Wird aus dem SFV-Provider synchronisiert oder manuell erfasst."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Wettkämpfe" },
        ]}
        stats={
          <div className="flex flex-wrap gap-4">
            <SectionCard className="flex-1 min-w-[120px]">
              <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
              <div className="text-sm text-gray-500">Aktive Wettkämpfe</div>
            </SectionCard>
            {archivedCount > 0 && (
              <SectionCard className="flex-1 min-w-[120px]">
                <div className="text-2xl font-bold text-gray-400">{archivedCount}</div>
                <div className="text-sm text-gray-500">Archiviert</div>
              </SectionCard>
            )}
            {canManage && (
              <SectionCard className="flex-1 min-w-[280px]">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  SFV Synchronisation
                </div>
                <CompetitionsSyncButton />
              </SectionCard>
            )}
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <CompetitionsSearchBar
              initialSearch={params.search ?? ""}
              initialProvider={params.provider ?? ""}
              initialIncludeArchived={params.includeArchived === "true"}
            />
            {canManage && <CompetitionsCreateButton />}
          </div>
        }
        isEmpty={competitions.length === 0}
        emptyIcon={<Trophy className="h-10 w-10" />}
        emptyHeading="Keine Wettkämpfe vorhanden"
        emptyDescription={
          filters.search
            ? `Keine Wettkämpfe für „${filters.search}" gefunden.`
            : "Noch keine Wettkämpfe vorhanden. Erstellen Sie manuell einen Wettkampf oder starten Sie eine SFV-Synchronisation."
        }
      >
        <CompetitionsTable competitions={competitions} canManage={canManage} />
      </ListPagePattern>
    </PageShell>
  );
}
