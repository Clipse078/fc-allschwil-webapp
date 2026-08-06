/**
 * /dashboard/teams/provider-mapping/[teamSeasonId]
 *
 * Detail page for provider mapping of a specific TeamSeason.
 *
 * Allows:
 *   - Viewing current mapping
 *   - Creating a new mapping (with suggestions)
 *   - Replacing an existing mapping
 *   - Removing a mapping
 *   - Viewing external identifiers and provider metadata
 *
 * TEAM-PROVIDER-01. German UI.
 */

import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getMappingsForTeamSeason } from "@/lib/provider-mapping/provider-mapping-queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import ProviderMappingDetail from "@/components/admin/teams/provider-mapping/ProviderMappingDetail";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ teamSeasonId: string }>;
  searchParams?: Promise<{ mappingId?: string }>;
};

export default async function ProviderMappingDetailPage({ params, searchParams }: PageProps) {
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

  const { teamSeasonId } = await params;
  const sp = (await searchParams) ?? {};

  // Load TeamSeason with all relevant context
  const teamSeason = await prisma.teamSeason.findFirst({
    where: { id: teamSeasonId, team: { tenantId } },
    select: {
      id: true,
      displayName: true,
      shortName: true,
      status: true,
      participationType: true,
      team: { select: { id: true, name: true, ageGroup: true, genderGroup: true } },
      season: { select: { id: true, name: true, key: true } },
      competitions: {
        select: {
          competition: {
            select: {
              id: true,
              officialName: true,
              shortName: true,
              provider: true,
              ageCategory: true,
              gender: true,
              externalCompetitionId: true,
              externalSeasonId: true,
              isArchived: true,
            },
          },
          isPrimary: true,
        },
        orderBy: { isPrimary: "desc" },
      },
    },
  });

  if (!teamSeason) {
    notFound();
  }

  // Load current mappings for this TeamSeason
  const currentMappings = await getMappingsForTeamSeason(tenantId, teamSeasonId);

  const canManage = session.user.permissionKeys?.includes(PERMISSIONS.TEAMS_MANAGE);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Anbieter-Mapping"
        title={teamSeason.displayName}
        description={`${teamSeason.team.name} · ${teamSeason.season.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Anbieter-Zuordnungen", href: "/dashboard/teams/provider-mapping" },
          { label: teamSeason.displayName, href: "#" },
        ]}
      >
        <ProviderMappingDetail
          teamSeason={{
            id: teamSeason.id,
            displayName: teamSeason.displayName,
            shortName: teamSeason.shortName,
            status: teamSeason.status,
            participationType: teamSeason.participationType,
            teamName: teamSeason.team.name,
            ageGroup: teamSeason.team.ageGroup,
            genderGroup: teamSeason.team.genderGroup,
            seasonId: teamSeason.season.id,
            seasonName: teamSeason.season.name,
            competitions: teamSeason.competitions.map((c) => ({
              id: c.competition.id,
              officialName: c.competition.officialName,
              shortName: c.competition.shortName,
              provider: c.competition.provider,
              ageCategory: c.competition.ageCategory,
              gender: c.competition.gender,
              externalCompetitionId: c.competition.externalCompetitionId,
              externalSeasonId: c.competition.externalSeasonId,
              isArchived: c.competition.isArchived,
              isPrimary: c.isPrimary,
            })),
          }}
          currentMappings={currentMappings}
          canManage={canManage ?? false}
          focusMappingId={sp.mappingId}
        />
      </ListPagePattern>
    </PageShell>
  );
}
