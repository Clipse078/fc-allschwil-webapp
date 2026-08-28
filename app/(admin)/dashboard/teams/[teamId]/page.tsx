import TeamCockpitShell from "@/components/admin/teams/TeamCockpitShell";
import {
  TEAM_COCKPIT_CATEGORY_LABELS,
  TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS,
  requireTeamCockpitAccess,
  buildTeamCockpitDisplayTitle,
} from "@/lib/teams/team-cockpit-layout";
import { buildTeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import { getTeamTrainingSchedule } from "@/lib/teams/team-training-schedule";
import { getOrgUnits } from "@/lib/org/queries";
import { getEligibleCompetitions } from "@/lib/competitions/queries";

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamOverviewPage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team, canManage, canDelete } =
    await requireTeamCockpitAccess(teamId);

  const [availableOrgUnits, availableCompetitions, trainingSchedule] =
    await Promise.all([
      getOrgUnits(tenantId),
      getEligibleCompetitions(tenantId),
      team.currentTeamSeasonId
        ? getTeamTrainingSchedule(tenantId, team.currentTeamSeasonId)
        : Promise.resolve([]),
    ]);

  const cockpitMetrics = buildTeamCockpitMetrics({
    team,
    categoryLabels: TEAM_COCKPIT_CATEGORY_LABELS,
    participationTypeLabels: TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS,
  });

  return (
    <TeamCockpitShell
      initialTeam={team}
      cockpitMetrics={cockpitMetrics}
      trainingSchedule={trainingSchedule}
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
      displayTitle={buildTeamCockpitDisplayTitle(team)}
    />
  );
}
