import { NextRequest, NextResponse } from "next/server";
import { Prisma, TeamSeasonStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string }>;
};

const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId, teamSeasonId } = await context.params;
    const body = await request.json();

    const existing = await prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: {
        season: true,
        team: true,
      },
    });

    if (!existing || existing.teamId !== teamId) {
      return NextResponse.json(
        { error: "Team-Saison nicht gefunden." },
        { status: 404 }
      );
    }

    const displayName = String(body.displayName ?? "").trim();
    const shortName =
      body.shortName === null || body.shortName === undefined
        ? null
        : String(body.shortName).trim() || null;
    const status = String(body.status ?? "").trim();
    const websiteVisible = Boolean(body.websiteVisible);
    const infoboardVisible = Boolean(body.infoboardVisible);

    if (!displayName) {
      return NextResponse.json(
        { error: "Display Name ist erforderlich." },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json(
        { error: "Ungueltiger Status." },
        { status: 400 }
      );
    }

    const updated = await prisma.teamSeason.update({
      where: { id: teamSeasonId },
      data: {
        displayName,
        shortName,
        status: status as TeamSeasonStatus,
        websiteVisible,
        infoboardVisible,
      },
      include: {
        season: true,
      },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "TeamSeason",
      entityId: updated.id,
      action: "UPDATE",
      beforeJson: {
        id: existing.id,
        teamId: existing.teamId,
        seasonId: existing.seasonId,
        displayName: existing.displayName,
        shortName: existing.shortName,
        status: existing.status,
        websiteVisible: existing.websiteVisible,
        infoboardVisible: existing.infoboardVisible,
      },
      afterJson: {
        id: updated.id,
        teamId: updated.teamId,
        seasonId: updated.seasonId,
        displayName: updated.displayName,
        shortName: updated.shortName,
        status: updated.status,
        websiteVisible: updated.websiteVisible,
        infoboardVisible: updated.infoboardVisible,
      },
      metadataJson: {
        seasonKey: existing.season.key,
        seasonName: existing.season.name,
        teamName: existing.team.name,
        teamSlug: existing.team.slug,
      },
    });

    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/teams/" + teamId);

    return NextResponse.json({
      message: "Team-Saison erfolgreich aktualisiert.",
      teamSeason: updated,
    });
  } catch (error) {
    console.error("Update team season failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Team-Saison konnte nicht aktualisiert werden, weil der Datensatz nicht mehr existiert." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Datenbankfehler: " + error.code + "." },
        { status: 500 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Prisma Validierungsfehler. Wahrscheinlich stimmen Schema, Migration und generierter Client aktuell nicht ueberein." },
        { status: 500 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Team-Saison konnte nicht aktualisiert werden." },
      { status: 500 }
    );
  }
}

