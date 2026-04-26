import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string; trainerMemberId: string }>;
};

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOrFallback(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

async function getExisting(trainerMemberId: string) {
  return prisma.trainerTeamMember.findUnique({
    where: { id: trainerMemberId },
    select: {
      id: true,
      teamSeasonId: true,
      personId: true,
      status: true,
      roleLabel: true,
      isWebsiteVisible: true,
      sortOrder: true,
      remarks: true,
      teamSeason: {
        select: {
          teamId: true,
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
          firstName: true,
          lastName: true,
          displayName: true,
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
    const { teamId, teamSeasonId, trainerMemberId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const existing = await getExisting(trainerMemberId);

    if (
      !existing ||
      existing.teamSeasonId !== teamSeasonId ||
      existing.teamSeason.teamId !== teamId
    ) {
      return NextResponse.json(
        { error: "Trainerteam-Eintrag nicht gefunden." },
        { status: 404 },
      );
    }

    const updated = await prisma.trainerTeamMember.update({
      where: { id: trainerMemberId },
      data: {
        status: typeof body.status === "string" ? body.status : existing.status,
        roleLabel: "roleLabel" in body ? textOrNull(body.roleLabel) : existing.roleLabel,
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
      entityType: "TrainerTeamMember",
      entityId: trainerMemberId,
      action: "UPDATE",
      beforeJson: {
        status: existing.status,
        roleLabel: existing.roleLabel,
        isWebsiteVisible: existing.isWebsiteVisible,
        sortOrder: existing.sortOrder,
        remarks: existing.remarks,
      },
      afterJson: {
        status: updated.status,
        roleLabel: updated.roleLabel,
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
      message: "Trainerteam-Eintrag erfolgreich aktualisiert.",
      member: updated,
    });
  } catch (error) {
    console.error("Update trainer member failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Trainerteam-Eintrag konnte nicht aktualisiert werden." },
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
    const { teamId, teamSeasonId, trainerMemberId } = await context.params;

    const existing = await getExisting(trainerMemberId);

    if (
      !existing ||
      existing.teamSeasonId !== teamSeasonId ||
      existing.teamSeason.teamId !== teamId
    ) {
      return NextResponse.json(
        { error: "Trainerteam-Eintrag nicht gefunden." },
        { status: 404 },
      );
    }

    await prisma.trainerTeamMember.delete({
      where: { id: trainerMemberId },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "TrainerTeamMember",
      entityId: trainerMemberId,
      action: "DELETE",
      beforeJson: {
        id: existing.id,
        teamSeasonId: existing.teamSeasonId,
        personId: existing.personId,
        status: existing.status,
        roleLabel: existing.roleLabel,
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
      message: "Trainer erfolgreich aus dem Trainerteam entfernt.",
    });
  } catch (error) {
    console.error("Delete trainer member failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Trainer konnte nicht aus dem Trainerteam entfernt werden." },
      { status: 500 },
    );
  }
}
