import Link from "next/link";
import { notFound } from "next/navigation";
import TeamDetailCard from "@/components/admin/teams/TeamDetailCard";
import TeamTrainingGuidancePanel from "@/components/admin/training/TeamTrainingGuidancePanel";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTeamDetailData } from "@/lib/teams/queries";
import { getSeasonOptionsData } from "@/lib/seasons/queries";

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.TEAMS_MANAGE);
  const { teamId } = await params;

  const [team, availableSeasons] = await Promise.all([
    getTeamDetailData(teamId),
    getSeasonOptionsData(),
  ]);

  if (!team) {
    notFound();
  }

  const activeSeason =
    availableSeasons.find((s) => s.isActive) ?? availableSeasons[0] ?? null;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Team"
        title={team.name}
        description="Stammdaten, Sichtbarkeit, Saisonzuordnungen sowie Kader- und Trainerteam-Management dieses Teams."
        actions={
          <Link href="/dashboard/teams" className="fca-button-secondary">
            Zurück zu Teams
          </Link>
        }
      />

      <TeamDetailCard
        initialTeam={team}
        availableSeasons={availableSeasons}
        canManage={canManage}
      />

      {activeSeason && (
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <TeamTrainingGuidancePanel
            teamId={teamId}
            teamName={team.name}
            seasonId={activeSeason.id}
            seasonName={activeSeason.name}
            seasonKey={activeSeason.key}
          />
        </section>
      )}
    </div>
  );
}
