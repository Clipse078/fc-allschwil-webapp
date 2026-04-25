import { notFound } from "next/navigation";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getSeasonOptionsData } from "@/lib/seasons/queries";
import { getTeamDetailDataBySeasonKeyAndTeamSlug } from "@/lib/teams/queries";

type Props = {
  params: Promise<{
    seasonKey: string;
    teamSlug: string;
  }>;
};

export default async function SeasonTeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  const { seasonKey, teamSlug } = await params;

  const [team, availableSeasons] = await Promise.all([
    getTeamDetailDataBySeasonKeyAndTeamSlug(seasonKey, teamSlug),
    getSeasonOptionsData(),
  ]);

  if (!team) {
    notFound();
  }

  return (
    <TeamDetailCard
      initialTeam={team}
      availableSeasons={availableSeasons}
      canManage={canManage}
    />
  );
}