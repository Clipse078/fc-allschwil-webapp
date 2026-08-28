import TeamAdministrationSection from "@/components/admin/teams/TeamAdministrationSection";
import ScopedResponsibilitiesCard from "@/components/admin/shared/ScopedResponsibilitiesCard";
import {
  requireTeamCockpitAccess,
  buildTeamCockpitDisplayTitle,
} from "@/lib/teams/team-cockpit-layout";
import { getScopedAssignmentsForOrgUnit } from "@/lib/roles/scoped-mutations";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { prisma } from "@/lib/db/prisma";
import { SectionCard } from "@/components/ui/page";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamAdministrationPage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, tenantKey, team, canManage, canDelete } =
    await requireTeamCockpitAccess(teamId);

  const teamOrgUnit = team.currentSeasonOrgUnit ?? team.orgUnit ?? null;
  const teamOrgUnitId = teamOrgUnit?.id ?? null;
  const displayTitle = buildTeamCockpitDisplayTitle(team);

  const [teamScopedAssignments, teamEligibleUsers, teamRolesForResponsibilities] =
    teamOrgUnitId
      ? await Promise.all([
          getScopedAssignmentsForOrgUnit(tenantId, teamOrgUnitId),
          getEligibleTenantMembers(tenantId),
          prisma.role.findMany({
            where: {
              scope: "TENANT",
              tenantId,
              isArchived: false,
              key: { not: getTenantClubAdminRoleKey(tenantKey) },
            },
            orderBy: { name: "asc" },
            select: { id: true, key: true, name: true, isSystem: true },
          }),
        ])
      : [[], [], []];

  return (
    <div className="space-y-6">
      <TeamAdministrationSection
        teamId={team.id}
        teamName={displayTitle}
        isActive={team.isActive}
        canManage={canManage}
        canDelete={canDelete}
        teamSeasons={team.teamSeasons.map((teamSeason) => ({
          id: teamSeason.id,
          displayName: teamSeason.displayName,
          season: { name: teamSeason.season.name },
        }))}
      />

      {teamOrgUnitId ? (
        <ScopedResponsibilitiesCard
          orgUnitId={teamOrgUnitId}
          orgUnitName={teamOrgUnit!.name}
          initialAssignments={teamScopedAssignments}
          availableRoles={teamRolesForResponsibilities}
          eligibleUsers={teamEligibleUsers}
          showScopeModeSelector={false}
          canManage={canManage}
          title="Zuständigkeiten"
          description="Organisatorische und administrative Verantwortlichkeiten — nicht Spielerkader oder Trainerteam."
        />
      ) : (
        <SectionCard title="Zuständigkeiten">
          <p className="text-sm text-[var(--muted)]">
            Organisatorische Zuständigkeiten erfordern eine verknüpfte
            Organisationseinheit. Dies ist getrennt von Spielerkader und
            Trainerteam.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
