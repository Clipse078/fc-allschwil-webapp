import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ teamSeasonId: string }>;
};

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
type AllowedTeamSeasonStatus = (typeof ALLOWED_STATUSES)[number];

function booleanFromBody(body: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof body[key] === "boolean" ? Boolean(body[key]) : fallback;
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamSeasonId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const existing = await prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: {
        season: true,
        team: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Team Season nicht gefunden." },
        { status: 404 }
      );
    }

    const displayName = String(body.displayName ?? existing.displayName).trim();
    const shortName =
      body.shortName === undefined
        ? existing.shortName
        : body.shortName === null
          ? null
          : String(body.shortName).trim() || null;
    const status = String(body.status ?? existing.status).trim();

    if (!displayName) {
      return NextResponse.json(
        { error: "Display Name ist erforderlich." },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.includes(status as AllowedTeamSeasonStatus)) {
      return NextResponse.json(
        { error: "Ungültiger Status für Team Season." },
        { status: 400 }
      );
    }

    const updated = await prisma.teamSeason.update({
      where: { id: teamSeasonId },
      data: {
        displayName,
        shortName,
        status: status as AllowedTeamSeasonStatus,
        websiteVisible: booleanFromBody(body, "websiteVisible", existing.websiteVisible),
        infoboardVisible: booleanFromBody(body, "infoboardVisible", existing.infoboardVisible),
        squadWebsiteVisible: booleanFromBody(body, "squadWebsiteVisible", existing.squadWebsiteVisible),
        trainerTeamWebsiteVisible: booleanFromBody(body, "trainerTeamWebsiteVisible", existing.trainerTeamWebsiteVisible),
        trainingsWebsiteVisible: booleanFromBody(body, "trainingsWebsiteVisible", existing.trainingsWebsiteVisible),
        upcomingMatchesWebsiteVisible: booleanFromBody(body, "upcomingMatchesWebsiteVisible", existing.upcomingMatchesWebsiteVisible),
        resultsWebsiteVisible: booleanFromBody(body, "resultsWebsiteVisible", existing.resultsWebsiteVisible),
        standingsWebsiteVisible: booleanFromBody(body, "standingsWebsiteVisible", existing.standingsWebsiteVisible),
      },
      include: {
        season: true,
      },
    });

    await logAction({
      actorUserId: access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null,
      moduleKey: "teams",
      entityType: "TeamSeason",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: existing,
      afterJson: updated,
      metadataJson: {
        teamName: existing.team.name,
        seasonName: existing.season.name,
      },
    });

    return NextResponse.json({
      message: "Team Season erfolgreich gespeichert.",
      teamSeason: updated,
    });
  } catch (error) {
    console.error("Update team season failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Team Season konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
