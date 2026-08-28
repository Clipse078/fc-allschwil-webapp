import TeamUpcomingMatchesView from "@/components/admin/teams/upcoming-matches/TeamUpcomingMatchesView";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import {
  getTeamCockpitSportingData,
  TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT,
} from "@/lib/teams/team-cockpit-sporting-data";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamSpielePage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team, tenant } = await requireTeamCockpitAccess(teamId);

  const activeSeason =
    team.teamSeasons.find((entry) => entry.id === team.currentTeamSeasonId) ?? null;

  const sportingData =
    team.currentTeamSeasonId && activeSeason
      ? await getTeamCockpitSportingData({
          tenantId,
          tenantClubName: tenant.name,
          tenantLogoUrl: tenant.logoUrl,
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
            nextMatches: TEAM_COCKPIT_NEXT_MATCHES_DETAIL_LIMIT,
            results: 0,
          },
        })
      : null;

  return (
    <TeamUpcomingMatchesView
      matches={sportingData?.nextMatches ?? []}
      seasonName={activeSeason?.season.name ?? null}
      formatConfig={{
        locale: tenant?.locale,
        timezone: tenant?.timezone,
      }}
    />
  );
}
