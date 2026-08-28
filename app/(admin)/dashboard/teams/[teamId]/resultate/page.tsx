import TeamCockpitSportingPlaceholder from "@/components/admin/teams/TeamCockpitSportingPlaceholder";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamResultatePage({ params }: Props) {
  await requireTeamCockpitAccess((await params).teamId);

  return (
    <TeamCockpitSportingPlaceholder
      title="Resultate"
      description="Die Resultatansicht für dieses Team wird in einem späteren Schritt implementiert."
    />
  );
}
