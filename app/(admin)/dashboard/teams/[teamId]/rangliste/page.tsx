import TeamStandingsView from "@/components/admin/teams/standings/TeamStandingsView";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import { getTeamCockpitSportingData } from "@/lib/teams/team-cockpit-sporting-data";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamRanglistePage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team } = await requireTeamCockpitAccess(teamId);

  const activeSeason =
    team.teamSeasons.find((entry) => entry.id === team.currentTeamSeasonId) ?? null;
  const hasProviderMapping = team.currentSeasonSfvMapping != null;

  const sportingData =
    team.currentTeamSeasonId && activeSeason
      ? await getTeamCockpitSportingData({
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
            results: 0,
          },
        })
      : null;

  return (
    <TeamStandingsView
      standings={sportingData?.standings ?? null}
      hasProviderMapping={hasProviderMapping}
    />
  );
}
