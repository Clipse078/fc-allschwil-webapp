import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";

function forbidden(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  const guard = await requireApiAnyPermission(["seasons.manage", "admin.manage"]);
  if (!guard.ok) return forbidden(guard.error, guard.status);

  const config = await prisma.clubConfig.findFirst({
    include: {
      activeSeason: true,
      nextSeason: true,
      websitePublishedSeason: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!config) {
    return NextResponse.json({ error: "Club configuration not found." }, { status: 404 });
  }

  if (!config.nextSeasonId) {
    return NextResponse.json({ error: "No next season configured." }, { status: 400 });
  }

  const before = {
    activeSeasonId: config.activeSeasonId,
    nextSeasonId: config.nextSeasonId,
    websitePublishedSeasonId: config.websitePublishedSeasonId,
  };

  const updated = await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      data: { isActive: false },
    });

    await tx.season.update({
      where: { id: config.nextSeasonId! },
      data: { isActive: true },
    });

    const result = await tx.clubConfig.update({
      where: { id: config.id },
      data: {
        activeSeasonId: config.nextSeasonId,
        websitePublishedSeasonId: config.seasonAutoSwitchWebsite
          ? config.nextSeasonId
          : config.websitePublishedSeasonId,
        nextSeasonId: null,
        seasonManualOverride: false,
      },
      include: {
        activeSeason: true,
        nextSeason: true,
        websitePublishedSeason: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: guard.session.user.id,
        moduleKey: "SEASONS",
        entityType: "ClubConfig",
        entityId: config.id,
        action: "SEASON_TRANSITION_TRIGGERED_MANUALLY",
        beforeJson: before,
        afterJson: {
          activeSeasonId: result.activeSeasonId,
          nextSeasonId: result.nextSeasonId,
          websitePublishedSeasonId: result.websitePublishedSeasonId,
        },
        metadataJson: {
          source: "admin-panel",
          trigger: "manual-now",
        },
      },
    });

    return result;
  });

  return NextResponse.json({ config: updated });
}
