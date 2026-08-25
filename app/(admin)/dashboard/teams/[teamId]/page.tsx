import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import TeamCockpitShell from "@/components/admin/teams/TeamCockpitShell";
import ScopedResponsibilitiesCard from "@/components/admin/shared/ScopedResponsibilitiesCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { buildTeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import { getTeamTrainingSchedule } from "@/lib/teams/team-training-schedule";
import { getTeamAttendanceOverview } from "@/lib/attendance/queries";
import { getUpcomingParticipationForTeam } from "@/lib/participation/queries";
import { getOrgUnits } from "@/lib/org/queries";
import { getEligibleCompetitions } from "@/lib/competitions/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";
import {
  getScopedAssignmentsForOrgUnit,
} from "@/lib/roles/scoped-mutations";
import { getTenantClubAdminRoleKey } from "@/lib/roles/tenant-role-keys";
import { prisma } from "@/lib/db/prisma";
import { PageShell, SectionCard } from "@/components/ui/page";
import { DetailPagePattern } from "@/components/ui/patterns";
import { Badge } from "@/components/ui";

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

const PARTICIPATION_TYPE_LABELS: Record<string, string> = {
  COMPETITION: "Wettkampfteam",
  TRAINING: "Trainingsgruppe",
  DEVELOPMENT: "Entwicklungsteam",
  RECREATIONAL: "Freizeitteam",
  OTHER: "Sonstiges",
};

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
    PERMISSIONS.TEAMS_DELETE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  const canDelete = hasPermission(session, PERMISSIONS.TEAMS_DELETE);
  const { teamId } = await params;

  const tenant = await getActiveTenant();
  if (!tenant) {
    notFound();
  }
  const tenantId = tenant.id;

  const [team, availableOrgUnits, availableCompetitions] = await Promise.all([
    getTeamDetailData(tenantId, teamId),
    getOrgUnits(tenantId),
    getEligibleCompetitions(tenantId),
  ]);

  if (!team) {
    notFound();
  }

  const teamOrgUnit = team.currentSeasonOrgUnit ?? team.orgUnit ?? null;
  const teamOrgUnitId = teamOrgUnit?.id ?? null;

  const [teamScopedAssignments, teamEligibleUsers, teamRolesForResponsibilities, trainingSchedule, attendanceOverview, upcomingParticipation] =
    await Promise.all([
      teamOrgUnitId
        ? getScopedAssignmentsForOrgUnit(tenantId, teamOrgUnitId)
        : Promise.resolve([]),
      teamOrgUnitId ? getEligibleTenantMembers(tenantId) : Promise.resolve([]),
      teamOrgUnitId
        ? prisma.role.findMany({
            where: {
              scope: "TENANT",
              tenantId,
              isArchived: false,
              key: { not: getTenantClubAdminRoleKey(tenant.key) },
            },
            orderBy: { name: "asc" },
            select: { id: true, key: true, name: true, isSystem: true },
          })
        : Promise.resolve([]),
      team.currentTeamSeasonId
        ? getTeamTrainingSchedule(tenantId, team.currentTeamSeasonId)
        : Promise.resolve([]),
      team.currentTeamSeasonId
        ? getTeamAttendanceOverview(tenantId, team.currentTeamSeasonId)
        : Promise.resolve(null),
      team.currentTeamSeasonId
        ? getUpcomingParticipationForTeam(tenantId, team.currentTeamSeasonId, teamId)
        : Promise.resolve(null),
    ]);

  const categoryLabel = CATEGORY_LABELS[team.category] ?? team.category;
  const activeSeason =
    team.teamSeasons.find((ts) => ts.id === team.currentTeamSeasonId) ?? null;

  const displayTitle = team.displayName ?? team.name;
  const competitionLabel = team.competition?.shortName ?? team.competition?.name ?? null;
  const metaLine = [
    team.shortName && team.shortName !== displayTitle ? team.shortName : null,
    categoryLabel,
    activeSeason?.season.name ?? (team.teamSeasons.length > 0 ? "Keine Saison im aktuellen Geschäftsjahr" : "Keine Saison"),
    competitionLabel ?? "Kein Wettbewerb",
  ]
    .filter(Boolean)
    .join(" · ");

  const cockpitMetrics = buildTeamCockpitMetrics({
    team,
    categoryLabels: CATEGORY_LABELS,
    participationTypeLabels: PARTICIPATION_TYPE_LABELS,
  });

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Teams"
        title={displayTitle}
        description={metaLine}
        headerBadge={
          <Badge variant={team.isActive ? "success" : "outline"}>
            {team.isActive ? "Aktiv" : "Archiviert"}
          </Badge>
        }
        breadcrumbs={[
          { label: "Teams", href: "/dashboard/teams" },
          { label: displayTitle },
        ]}
        headerActions={
          <Link
            href="/dashboard/teams"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Teams
          </Link>
        }
      >
        <div className="space-y-6">
          <TeamCockpitShell
            initialTeam={team}
            cockpitMetrics={cockpitMetrics}
            trainingSchedule={trainingSchedule}
            attendanceOverview={attendanceOverview}
            upcomingParticipation={upcomingParticipation}
            canManage={canManage}
            canDelete={canDelete}
            availableOrgUnits={availableOrgUnits.map((ou) => ({
              id: ou.id,
              name: ou.name,
              key: ou.key,
              type: ou.type,
            }))}
            availableCompetitions={availableCompetitions.map((c) => ({
              id: c.id,
              officialName: c.officialName,
              shortName: c.shortName,
            }))}
            displayTitle={displayTitle}
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
      </DetailPagePattern>
    </PageShell>
  );
}
