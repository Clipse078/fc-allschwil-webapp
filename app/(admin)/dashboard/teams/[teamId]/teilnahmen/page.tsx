import TeamParticipationSection from "@/components/admin/teams/TeamParticipationSection";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import { getUpcomingParticipationForTeam } from "@/lib/participation/queries";
import { SectionCard } from "@/components/ui/page";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamTeilnahmenPage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team } = await requireTeamCockpitAccess(teamId);

  const upcomingParticipation = team.currentTeamSeasonId
    ? await getUpcomingParticipationForTeam(
        tenantId,
        team.currentTeamSeasonId,
        teamId,
      )
    : null;

  if (!upcomingParticipation) {
    return (
      <SectionCard title="Teilnahmen">
        <p className="text-sm text-[var(--muted)]">
          {team.teamSeasons.length > 0
            ? "Für die aktuelle Geschäftsjahr-Saison sind keine Teilnahmen verfügbar."
            : "Noch keine Team-Saison vorhanden. Teilnahmen erfordern mindestens eine Team-Saison."}
        </p>
      </SectionCard>
    );
  }

  return (
    <TeamParticipationSection
      teamId={team.id}
      teamSeasonId={upcomingParticipation.teamSeasonId}
      initialUpcoming={upcomingParticipation}
    />
  );
}
