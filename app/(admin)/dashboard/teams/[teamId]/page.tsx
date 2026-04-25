import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type Props = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamDetailRedirectPage({ params }: Props) {
  await requireAnyPermission([
    PERMISSIONS.TEAMS_VIEW,
    PERMISSIONS.TEAMS_MANAGE,
  ]);

  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      teamSeasons: {
        include: { season: true },
        orderBy: [{ season: { startDate: "desc" } }],
      },
    },
  });

  if (!team) {
    notFound();
  }

  const activeTeamSeason =
    team.teamSeasons.find((entry) => entry.season.isActive) ??
    team.teamSeasons[0] ??
    null;

  if (!activeTeamSeason) {
    redirect("/dashboard/teams");
  }

  redirect(`/dashboard/seasons/${activeTeamSeason.season.key}/teams/${team.slug}`);
}
