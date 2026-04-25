import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ teamSeasonId: string }> }) {
  try {
    const { teamSeasonId } = await params;
    const body = await req.json();

    const {
      teamId,
      trainingsWebsiteVisible,
      upcomingMatchesWebsiteVisible,
      standingsWebsiteVisible,
      resultsWebsiteVisible,
      trainerTeamWebsiteVisible,
      squadWebsiteVisible,
      teamPageWebsiteVisible,
    } = body as {
      teamId?: string;
      trainingsWebsiteVisible?: boolean;
      upcomingMatchesWebsiteVisible?: boolean;
      standingsWebsiteVisible?: boolean;
      resultsWebsiteVisible?: boolean;
      trainerTeamWebsiteVisible?: boolean;
      squadWebsiteVisible?: boolean;
      teamPageWebsiteVisible?: boolean;
    };

    const teamSeasonData: Record<string, boolean> = {};

    if (typeof trainingsWebsiteVisible === "boolean") teamSeasonData.trainingsWebsiteVisible = trainingsWebsiteVisible;
    if (typeof upcomingMatchesWebsiteVisible === "boolean") teamSeasonData.upcomingMatchesWebsiteVisible = upcomingMatchesWebsiteVisible;
    if (typeof standingsWebsiteVisible === "boolean") teamSeasonData.standingsWebsiteVisible = standingsWebsiteVisible;
    if (typeof resultsWebsiteVisible === "boolean") teamSeasonData.resultsWebsiteVisible = resultsWebsiteVisible;
    if (typeof trainerTeamWebsiteVisible === "boolean") teamSeasonData.trainerTeamWebsiteVisible = trainerTeamWebsiteVisible;
    if (typeof squadWebsiteVisible === "boolean") teamSeasonData.squadWebsiteVisible = squadWebsiteVisible;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(teamSeasonData).length > 0) {
        await tx.teamSeason.update({
          where: { id: teamSeasonId },
          data: teamSeasonData,
        });
      }

      if (teamId && typeof teamPageWebsiteVisible === "boolean") {
        await tx.team.update({
          where: { id: teamId },
          data: { websiteVisible: teamPageWebsiteVisible },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update website visibility" }, { status: 500 });
  }
}