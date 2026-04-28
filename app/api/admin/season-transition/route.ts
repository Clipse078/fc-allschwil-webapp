import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";

function forbidden(message: string, status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const guard = await requireApiAnyPermission(["seasons.manage", "admin.manage", "teams.manage"]);
  if (!guard.ok) return forbidden(guard.error, guard.status);

  const config = await prisma.clubConfig.findFirst({
    include: {
      activeSeason: true,
      nextSeason: true,
      websitePublishedSeason: true
    },
    orderBy: { createdAt: "asc" }
  });

  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      key: true,
      startDate: true,
      endDate: true,
      isActive: true
    }
  });

  return NextResponse.json({ config, seasons });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireApiAnyPermission(["seasons.manage", "admin.manage"]);
  if (!guard.ok) return forbidden(guard.error, guard.status);

  const body = await request.json();

  const config = await prisma.clubConfig.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (!config) {
    return NextResponse.json({ error: "Club configuration not found." }, { status: 404 });
  }

  const transitionDate =
    typeof body.seasonTransitionDate === "string" && body.seasonTransitionDate.length > 0
      ? new Date(`${body.seasonTransitionDate}T00:00:00.000Z`)
      : null;

  const before = {
    activeSeasonId: config.activeSeasonId,
    nextSeasonId: config.nextSeasonId,
    websitePublishedSeasonId: config.websitePublishedSeasonId,
    seasonTransitionDate: config.seasonTransitionDate,
    seasonTransitionMode: config.seasonTransitionMode,
    seasonAutoSwitchWebsite: config.seasonAutoSwitchWebsite,
    seasonManualOverride: config.seasonManualOverride,
    seasonTransitionNotes: config.seasonTransitionNotes
  };

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.clubConfig.update({
      where: { id: config.id },
      data: {
        activeSeasonId: body.activeSeasonId || null,
        nextSeasonId: body.nextSeasonId || null,
        websitePublishedSeasonId: body.websitePublishedSeasonId || null,
        seasonTransitionDate: transitionDate,
        seasonTransitionMode: body.seasonTransitionMode ?? "PREVIEW_FIRST",
        seasonAutoSwitchWebsite: Boolean(body.seasonAutoSwitchWebsite),
        seasonManualOverride: Boolean(body.seasonManualOverride),
        seasonTransitionNotes: body.seasonTransitionNotes || null
      },
      include: {
        activeSeason: true,
        nextSeason: true,
        websitePublishedSeason: true
      }
    });

    await tx.auditLog.create({
      data: {
        actorUserId: guard.session.user.id,
        moduleKey: "SEASONS",
        entityType: "ClubConfig",
        entityId: config.id,
        action: "SEASON_TRANSITION_SETTINGS_UPDATED",
        beforeJson: before,
        afterJson: {
          activeSeasonId: result.activeSeasonId,
          nextSeasonId: result.nextSeasonId,
          websitePublishedSeasonId: result.websitePublishedSeasonId,
          seasonTransitionDate: result.seasonTransitionDate,
          seasonTransitionMode: result.seasonTransitionMode,
          seasonAutoSwitchWebsite: result.seasonAutoSwitchWebsite,
          seasonManualOverride: result.seasonManualOverride,
          seasonTransitionNotes: result.seasonTransitionNotes
        },
        metadataJson: {
          source: "admin-panel"
        }
      }
    });

    return result;
  });

  return NextResponse.json({ config: updated });
}
