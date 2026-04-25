import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{
    teamId: string;
    teamSeasonId: string;
    squadMemberId: string;
  }>;
};

export async function DELETE(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId, teamSeasonId, squadMemberId } = await context.params;

    const existing = await prisma.playerSquadMember.findUnique({
      where: { id: squadMemberId },
      include: {
        teamSeason: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            season: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
        },
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (
      !existing ||
      existing.teamSeasonId !== teamSeasonId ||
      existing.teamSeason.teamId !== teamId
    ) {
      return NextResponse.json(
        { error: "Kader-Eintrag nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.playerSquadMember.delete({
      where: { id: squadMemberId },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "PlayerSquadMember",
      entityId: squadMemberId,
      action: "DELETE",
      beforeJson: {
        id: existing.id,
        teamSeasonId: existing.teamSeasonId,
        personId: existing.personId,
        status: existing.status,
        shirtNumber: existing.shirtNumber,
        positionLabel: existing.positionLabel,
        isCaptain: existing.isCaptain,
        isViceCaptain: existing.isViceCaptain,
        isWebsiteVisible: existing.isWebsiteVisible,
        sortOrder: existing.sortOrder,
        remarks: existing.remarks,
      },
      metadataJson: {
        teamId: existing.teamSeason.team.id,
        teamName: existing.teamSeason.team.name,
        teamSlug: existing.teamSeason.team.slug,
        seasonId: existing.teamSeason.season.id,
        seasonKey: existing.teamSeason.season.key,
        seasonName: existing.teamSeason.season.name,
        personName:
          existing.person.displayName ||
          (existing.person.firstName + " " + existing.person.lastName),
      },
    });

    revalidatePath("/dashboard/teams");
    revalidatePath(
      `/dashboard/seasons/${existing.teamSeason.season.key}/teams/${existing.teamSeason.team.slug}`,
    );

    return NextResponse.json({
      message: "Spieler erfolgreich aus dem Team-Saison-Kader entfernt.",
    });
  } catch (error) {
    console.error("Delete squad member failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Kader-Eintrag konnte nicht geloescht werden, weil der Datensatz nicht mehr existiert." },
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
      { error: "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden." },
      { status: 500 }
    );
  }
}

