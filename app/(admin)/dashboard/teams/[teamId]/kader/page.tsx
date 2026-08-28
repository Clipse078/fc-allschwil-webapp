import TeamRosterOverviewCard from "@/components/admin/teams/TeamRosterOverviewCard";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamKaderPage({ params }: Props) {
  const { teamId } = await params;
  const { team, canManage } = await requireTeamCockpitAccess(teamId);

  return (
    <TeamRosterOverviewCard
      teamId={team.id}
      teamAgeGroup={team.ageGroup}
      canManage={canManage}
      teamSeasons={team.teamSeasons}
      currentTeamSeasonId={team.currentTeamSeasonId ?? null}
      mode="squad"
    />
  );
}
