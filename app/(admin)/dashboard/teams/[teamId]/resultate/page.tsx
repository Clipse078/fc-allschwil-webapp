import TeamResultsView from "@/components/admin/teams/results/TeamResultsView";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import {
  getTeamCockpitSportingData,
  TEAM_COCKPIT_RESULTS_DETAIL_LIMIT,
} from "@/lib/teams/team-cockpit-sporting-data";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamResultatePage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team } = await requireTeamCockpitAccess(teamId);

  const activeSeason =
    team.teamSeasons.find((entry) => entry.id === team.currentTeamSeasonId) ?? null;

  const [tenant, sportingData] = await Promise.all([
    getActiveTenant(),
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
          limits: {
            nextMatches: 0,
            results: TEAM_COCKPIT_RESULTS_DETAIL_LIMIT,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <TeamResultsView
      results={sportingData?.results ?? []}
      seasonName={activeSeason?.season.name ?? null}
      formatConfig={{
        locale: tenant?.locale,
        timezone: tenant?.timezone,
      }}
    />
  );
}
