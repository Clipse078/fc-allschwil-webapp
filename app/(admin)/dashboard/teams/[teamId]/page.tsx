import TeamCockpitOverviewContent from "@/components/admin/teams/overview/TeamCockpitOverviewContent";
import {
  TEAM_COCKPIT_CATEGORY_LABELS,
  TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS,
  requireTeamCockpitAccess,
} from "@/lib/teams/team-cockpit-layout";
import { buildTeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import { getTeamCockpitSportingData } from "@/lib/teams/team-cockpit-sporting-data";
import { getTeamTrainingSchedule } from "@/lib/teams/team-training-schedule";
import { getOrgUnits } from "@/lib/org/queries";
import { getEligibleCompetitions } from "@/lib/competitions/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamOverviewPage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team, canManage } = await requireTeamCockpitAccess(teamId);

  const activeSeason =
    team.teamSeasons.find((entry) => entry.id === team.currentTeamSeasonId) ?? null;

  const [availableOrgUnits, availableCompetitions, trainingSchedule, sportingData, tenant] =
    await Promise.all([
      getOrgUnits(tenantId),
      getEligibleCompetitions(tenantId),
      team.currentTeamSeasonId
        ? getTeamTrainingSchedule(tenantId, team.currentTeamSeasonId)
        : Promise.resolve([]),
      team.currentTeamSeasonId && activeSeason
        ? getTeamCockpitSportingData({
            tenantId,
            teamId: team.id,
            teamSeasonId: team.currentTeamSeasonId,
            seasonKey: activeSeason.season.key,
            teamDisplayName: team.displayName ?? team.name,
            teamShortName: team.shortName,
            canonicalCompetition: team.competition
              ? {
                  name: team.competition.name ?? "",
                  shortName: team.competition.shortName,
                }
              : null,
            sfvMapping: team.currentSeasonSfvMapping,
            limits: { nextMatches: 1, results: 1 },
          })
        : Promise.resolve(null),
      getActiveTenant(),
    ]);

  const cockpitMetrics = buildTeamCockpitMetrics({
    team,
    categoryLabels: TEAM_COCKPIT_CATEGORY_LABELS,
    participationTypeLabels: TEAM_COCKPIT_PARTICIPATION_TYPE_LABELS,
  });

  const formatConfig = {
    locale: tenant?.locale,
    timezone: tenant?.timezone,
  };

  return (
    <TeamCockpitOverviewContent
      team={team}
      nextMatch={sportingData?.nextMatches[0] ?? null}
      latestResult={sportingData?.results[0] ?? null}
      standings={sportingData?.standings ?? null}
      trainingSchedule={trainingSchedule}
      playerCount={cockpitMetrics.playerCount}
      trainerCount={cockpitMetrics.trainerCount}
      formatConfig={formatConfig}
      canManage={canManage}
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
    />
  );
}
