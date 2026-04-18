import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { logAction } from "@/lib/audit/log-action";

type Context = {
  params: Promise<{
    seasonId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.SEASONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { seasonId } = await context.params;

    const targetSeason = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        key: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    if (!targetSeason) {
      return NextResponse.json(
        { error: "Saison nicht gefunden." },
        { status: 404 }
      );
    }

    const currentActiveSeason = await prisma.season.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    if (targetSeason.isActive) {
      return NextResponse.json({
        message: 'Saison "' + targetSeason.name + '" ist bereits aktiv.',
        season: targetSeason,
      });
    }

    await prisma.$transaction([
      prisma.season.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.season.update({
        where: { id: targetSeason.id },
        data: { isActive: true },
      }),
    ]);

    await logAction({
      actorUserId:
        access.session?.user?.effectiveUserId ??
        access.session?.user?.id ??
        null,
      moduleKey: "seasons",
      entityType: "Season",
      entityId: targetSeason.id,
      action: "ACTIVATE",
      beforeJson: {
        previousActiveSeason: currentActiveSeason,
      },
      afterJson: {
        activeSeason: {
          id: targetSeason.id,
          key: targetSeason.key,
          name: targetSeason.name,
        },
      },
      metadataJson: {
        previousActiveSeasonId: currentActiveSeason?.id ?? null,
        previousActiveSeasonKey: currentActiveSeason?.key ?? null,
        previousActiveSeasonName: currentActiveSeason?.name ?? null,
        newActiveSeasonId: targetSeason.id,
        newActiveSeasonKey: targetSeason.key,
        newActiveSeasonName: targetSeason.name,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/seasons");
    revalidatePath("/dashboard/seasons/planner");
    revalidatePath("/dashboard/teams");

    return NextResponse.json({
      message: 'Saison "' + targetSeason.name + '" wurde erfolgreich aktiviert.',
    });
  } catch (error) {
    console.error("Activate season failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Saison konnte nicht aktiviert werden." },
      { status: 500 }
    );
  }
}
