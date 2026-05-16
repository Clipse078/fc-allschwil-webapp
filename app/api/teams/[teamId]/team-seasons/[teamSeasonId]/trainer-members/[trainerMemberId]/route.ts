import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ teamId: string; teamSeasonId: string; trainerMemberId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { teamId, teamSeasonId, trainerMemberId } = await context.params;

    const existing = await prisma.trainerTeamMember.findUnique({
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
        person: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    if (!existing || existing.teamSeasonId !== teamSeasonId) {
      return NextResponse.json(
        { error: "Trainerteam-Eintrag nicht gefunden." },
        { status: 404 }
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
      beforeJson: existing,
      metadataJson: {
        teamId,
        teamSeasonId,
        personName:
          existing.person.displayName ||
          (existing.person.firstName + " " + existing.person.lastName),
      },
    });

    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/teams/" + teamId);

    return NextResponse.json({
      message: "Trainer erfolgreich aus dem Trainerteam entfernt.",
    });
  } catch (error) {
    console.error("Delete trainer member failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Trainer konnte nicht aus dem Trainerteam entfernt werden." },
      { status: 500 }
    );
  }
}
