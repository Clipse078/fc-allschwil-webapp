import TeamAttendanceSection from "@/components/admin/teams/TeamAttendanceSection";
import { requireTeamCockpitAccess } from "@/lib/teams/team-cockpit-layout";
import { getTeamAttendanceOverview } from "@/lib/attendance/queries";
import { SectionCard } from "@/components/ui/page";

type Props = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamAnwesenheitPage({ params }: Props) {
  const { teamId } = await params;
  const { tenantId, team, canManage } = await requireTeamCockpitAccess(teamId);

  const attendanceOverview = team.currentTeamSeasonId
    ? await getTeamAttendanceOverview(tenantId, team.currentTeamSeasonId)
    : null;

  if (!attendanceOverview) {
    return (
      <SectionCard title="Anwesenheit">
        <p className="text-sm text-[var(--muted)]">
          {team.teamSeasons.length > 0
            ? "Für die aktuelle Geschäftsjahr-Saison ist keine Anwesenheit verfügbar."
            : "Noch keine Team-Saison vorhanden. Anwesenheit erfordert mindestens eine Team-Saison."}
        </p>
      </SectionCard>
    );
  }

  return (
    <TeamAttendanceSection
      teamId={team.id}
      teamSeasonId={attendanceOverview.teamSeasonId}
      initialOverview={attendanceOverview}
      canManage={canManage}
    />
  );
}
