/**
 * /dashboard/teams/provider-mapping/mapping/[mappingId]
 *
 * Assignment page for a specific TeamExternalMapping row.
 *
 * Handles both states of a TeamExternalMapping:
 *   - UNMAPPED (teamSeasonId = null): shows provider team details and a
 *     TeamSeason selector so the administrator can assign a canonical team.
 *   - ALREADY MAPPED (teamSeasonId is set): shows the current assignment
 *     and redirects to the TeamSeason-based mapping page.
 *
 * This route is the canonical target for the "Bearbeiten" action on unmapped
 * rows in the provider-mapping overview.
 *
 * TEAM-PROVIDER-01. German UI. Server Component.
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantFromSession } from "@/lib/tenants/queries";
import { getProviderMappingById, getEligibleTeamSeasonsForMapping } from "@/lib/provider-mapping/provider-mapping-queries";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import ProviderMappingAssignForm from "@/components/admin/teams/provider-mapping/ProviderMappingAssignForm";

type PageProps = {
  params: Promise<{ mappingId: string }>;
};

export default async function ProviderMappingAssignPage({ params }: PageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const tenant = await getTenantFromSession(session.user.tenantId);
  if (!tenant) {
    notFound();
  }
  const tenantId = tenant.id;

  const { mappingId } = await params;
  const mapping = await getProviderMappingById(tenantId, mappingId);

  if (!mapping) {
    notFound();
  }

  // If already mapped to a TeamSeason, redirect to the TeamSeason-based page.
  if (mapping.teamSeasonId) {
    redirect(
      `/dashboard/teams/provider-mapping/${mapping.teamSeasonId}?mappingId=${mapping.id}`
    );
  }

  // Unmapped: show assignment UI.
  const canManage = session.user.permissionKeys?.includes(PERMISSIONS.TEAMS_MANAGE) ?? false;
  const eligibleTeamSeasons = await getEligibleTeamSeasonsForMapping(tenantId);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Anbieter-Mapping"
        title="Anbieter-Team zuordnen"
        description={`${mapping.providerTeamName ?? `ID ${mapping.externalTeamId}`} · ${mapping.provider}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Anbieter-Zuordnungen", href: "/dashboard/teams/provider-mapping" },
          { label: "Zuordnen", href: "#" },
        ]}
        headerActions={
          <Link
            href="/dashboard/teams/provider-mapping"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Übersicht
          </Link>
        }
      >
        <ProviderMappingAssignForm
          mapping={mapping}
          eligibleTeamSeasons={eligibleTeamSeasons}
          canManage={canManage}
        />
      </ListPagePattern>
    </PageShell>
  );
}
