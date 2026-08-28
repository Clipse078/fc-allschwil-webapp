import TeamCockpitSportingPlaceholder from "@/components/admin/teams/TeamCockpitSportingPlaceholder";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamSpielePage({ params }: Props) {
  await requireTeamCockpitAccess((await params).teamId);

  return (
    <TeamCockpitSportingPlaceholder
      title="Nächste Spiele"
      description="Die Spielübersicht für dieses Team wird in einem späteren Schritt implementiert."
    />
  );
}
