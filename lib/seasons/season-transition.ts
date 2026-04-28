import { prisma } from "@/lib/db/prisma";

export type SeasonTransitionSnapshot = {
  clubName: string;
  activeSeason: string;
  nextSeason: string;
  websiteSeason: string;
  transitionDate: string | null;
  transitionMode: string;
  autoSwitchWebsite: boolean;
  manualOverride: boolean;
  canTransitionNow: boolean;
};

export async function getSeasonTransitionSnapshot(): Promise<SeasonTransitionSnapshot | null> {
  const config = await prisma.clubConfig.findFirst({
    include: {
      activeSeason: true,
      nextSeason: true,
      websitePublishedSeason: true
    },
    orderBy: { createdAt: "asc" }
  });

  if (!config) return null;

  const transitionDate = config.seasonTransitionDate;
  const canTransitionNow =
    Boolean(transitionDate) &&
    !config.seasonManualOverride &&
    transitionDate!.getTime() <= Date.now();

  return {
    clubName: config.clubName,
    activeSeason: config.activeSeason?.name ?? "Nicht gesetzt",
    nextSeason: config.nextSeason?.name ?? "Nicht gesetzt",
    websiteSeason: config.websitePublishedSeason?.name ?? config.activeSeason?.name ?? "Nicht gesetzt",
    transitionDate: transitionDate ? transitionDate.toISOString().slice(0, 10) : null,
    transitionMode: config.seasonTransitionMode,
    autoSwitchWebsite: config.seasonAutoSwitchWebsite,
    manualOverride: config.seasonManualOverride,
    canTransitionNow
  };
}

export async function applySeasonTransitionIfDue(actorUserId?: string | null) {
  const config = await prisma.clubConfig.findFirst({
    include: {
      activeSeason: true,
      nextSeason: true,
      websitePublishedSeason: true
    },
    orderBy: { createdAt: "asc" }
  });

  if (!config?.nextSeasonId || !config.seasonTransitionDate) {
    return { changed: false, reason: "No transition configured." };
  }

  if (config.seasonManualOverride) {
    return { changed: false, reason: "Manual override enabled." };
  }

  if (config.seasonTransitionDate.getTime() > Date.now()) {
    return { changed: false, reason: "Transition date not reached." };
  }

  const before = {
    activeSeasonId: config.activeSeasonId,
    websitePublishedSeasonId: config.websitePublishedSeasonId,
    nextSeasonId: config.nextSeasonId
  };

  const updated = await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      data: { isActive: false }
    });

    await tx.season.update({
      where: { id: config.nextSeasonId! },
      data: { isActive: true }
    });

    const clubConfig = await tx.clubConfig.update({
      where: { id: config.id },
      data: {
        activeSeasonId: config.nextSeasonId,
        websitePublishedSeasonId: config.seasonAutoSwitchWebsite ? config.nextSeasonId : config.websitePublishedSeasonId,
        nextSeasonId: null
      }
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        moduleKey: "SEASONS",
        entityType: "ClubConfig",
        entityId: config.id,
        action: "SEASON_TRANSITION_APPLIED",
        beforeJson: before,
        afterJson: {
          activeSeasonId: clubConfig.activeSeasonId,
          websitePublishedSeasonId: clubConfig.websitePublishedSeasonId,
          nextSeasonId: clubConfig.nextSeasonId
        },
        metadataJson: {
          source: "season-transition",
          transitionDate: config.seasonTransitionDate?.toISOString() ?? null,
          mode: config.seasonTransitionMode
        }
      }
    });

    return clubConfig;
  });

  return { changed: true, config: updated };
}

