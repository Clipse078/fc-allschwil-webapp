import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{ personId: string; qualificationId: string }>;
};

export async function DELETE(_: Request, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.TEAMS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { personId, qualificationId } = await context.params;

    const existing = await prisma.trainerQualification.findUnique({
      where: { id: qualificationId },
      include: {
        person: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    if (!existing || existing.personId !== personId) {
      return NextResponse.json(
        { error: "Trainer-Diplom nicht gefunden." },
        { status: 404 }
      );
    }

    await prisma.trainerQualification.delete({
      where: { id: qualificationId },
    });

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "teams",
      entityType: "TrainerQualification",
      entityId: qualificationId,
      action: "DELETE",
      beforeJson: existing,
      metadataJson: {
        personId,
        personName:
          existing.person.displayName ||
          existing.person.firstName + " " + existing.person.lastName,
      },
    });

    revalidatePath("/dashboard/teams");

    return NextResponse.json({
      message: "Trainer-Diplom erfolgreich gelöscht.",
    });
  } catch (error) {
    console.error("Delete trainer qualification failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Trainer-Diplom konnte nicht gelöscht werden.",
      },
      { status: 500 }
    );
  }
}