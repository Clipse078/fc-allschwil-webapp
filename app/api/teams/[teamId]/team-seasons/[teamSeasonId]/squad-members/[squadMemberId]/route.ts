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

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function numberOrFallback(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

async function getExisting(squadMemberId: string) {
  return prisma.playerSquadMember.findUnique({
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
}

function revalidateTeamPaths(existing: NonNullable<Awaited<ReturnType<typeof getExisting>>>) {
  revalidatePath("/dashboard/teams");
  revalidatePath(
    `/dashboard/seasons/${existing.teamSeason.season.key}/teams/${existing.teamSeason.team.slug}`,
  );
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId, teamSeasonId, squadMemberId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const existing = await getExisting(squadMemberId);

    if (
      !existing ||
      existing.teamSeasonId !== teamSeasonId ||
      existing.teamSeason.teamId !== teamId
    ) {
      return NextResponse.json(
        { error: "Kader-Eintrag nicht gefunden." },
        { status: 404 },
      );
    }

    const updated = await prisma.playerSquadMember.update({
      where: { id: squadMemberId },
      data: {
        status: typeof body.status === "string" ? body.status : existing.status,
        shirtNumber: "shirtNumber" in body ? numberOrNull(body.shirtNumber) : existing.shirtNumber,
        positionLabel: "positionLabel" in body ? textOrNull(body.positionLabel) : existing.positionLabel,
        isCaptain: typeof body.isCaptain === "boolean" ? body.isCaptain : existing.isCaptain,
        isViceCaptain: typeof body.isViceCaptain === "boolean" ? body.isViceCaptain : existing.isViceCaptain,
        isWebsiteVisible: typeof body.isWebsiteVisible === "boolean" ? body.isWebsiteVisible : existing.isWebsiteVisible,
        sortOrder: "sortOrder" in body ? numberOrFallback(body.sortOrder, existing.sortOrder) : existing.sortOrder,
        remarks: "remarks" in body ? textOrNull(body.remarks) : existing.remarks,
      },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "PlayerSquadMember",
      entityId: squadMemberId,
      action: "UPDATE",
      beforeJson: {
        status: existing.status,
        shirtNumber: existing.shirtNumber,
        positionLabel: existing.positionLabel,
        isCaptain: existing.isCaptain,
        isViceCaptain: existing.isViceCaptain,
        isWebsiteVisible: existing.isWebsiteVisible,
        sortOrder: existing.sortOrder,
        remarks: existing.remarks,
      },
      afterJson: {
        status: updated.status,
        shirtNumber: updated.shirtNumber,
        positionLabel: updated.positionLabel,
        isCaptain: updated.isCaptain,
        isViceCaptain: updated.isViceCaptain,
        isWebsiteVisible: updated.isWebsiteVisible,
        sortOrder: updated.sortOrder,
        remarks: updated.remarks,
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

    revalidateTeamPaths(existing);

    return NextResponse.json({
      message: "Kader-Eintrag erfolgreich aktualisiert.",
      member: updated,
    });
  } catch (error) {
    console.error("Update squad member failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Kader-Eintrag konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(_: NextRequest, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId, teamSeasonId, squadMemberId } = await context.params;

    const existing = await getExisting(squadMemberId);

    if (
      !existing ||
      existing.teamSeasonId !== teamSeasonId ||
      existing.teamSeason.teamId !== teamId
    ) {
      return NextResponse.json(
        { error: "Kader-Eintrag nicht gefunden." },
        { status: 404 },
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

    revalidateTeamPaths(existing);

    return NextResponse.json({
      message: "Spieler erfolgreich aus dem Team-Saison-Kader entfernt.",
    });
  } catch (error) {
    console.error("Delete squad member failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Kader-Eintrag konnte nicht gelöscht werden, weil der Datensatz nicht mehr existiert." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: "Datenbankfehler: " + error.code + "." },
        { status: 500 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden." },
      { status: 500 },
    );
  }
}
