import { prisma } from "@/lib/db/prisma";
import { getIsoWeekInfo, getWeekRangeFromWeekId } from "@/lib/weekly-plan/iso-week";

export type WeeklyPlanPublicationState = {
  tenantId: string;
  weekId: string;
  isoYear: number;
  isoWeek: number;
  monday: Date;
  sunday: Date;
  variantLabel: string;
  isPublished: boolean;
  publishedAt: Date | null;
  publishedByUserId: string | null;
  publicationId: string | null;
};

export function getWeeklyPlanWeekContext(input: Date | string) {
  if (input instanceof Date) {
    return getIsoWeekInfo(input);
  }

  return getWeekRangeFromWeekId(input);
}

export async function getWeeklyPlanPublicationState(args: {
  tenantId: string;
  date?: Date;
  weekId?: string;
}): Promise<WeeklyPlanPublicationState> {
  if (!args.tenantId) {
    throw new Error("tenantId is required.");
  }

  const context = args.weekId
    ? getWeekRangeFromWeekId(args.weekId)
    : getIsoWeekInfo(args.date ?? new Date());

  const publication = await prisma.wochenplanPublication.findUnique({
    where: {
      tenantId_weekId: {
        tenantId: args.tenantId,
        weekId: context.weekId,
      },
    },
    select: {
      id: true,
      variantLabel: true,
      isPublished: true,
      publishedAt: true,
      publishedByUserId: true,
    },
  });

  return {
    tenantId: args.tenantId,
    weekId: context.weekId,
    isoYear: context.isoYear,
    isoWeek: context.isoWeek,
    monday: context.monday,
    sunday: context.sunday,
    variantLabel: publication?.variantLabel ?? "Standard-Wochenplan",
    isPublished: publication?.isPublished ?? false,
    publishedAt: publication?.publishedAt ?? null,
    publishedByUserId: publication?.publishedByUserId ?? null,
    publicationId: publication?.id ?? null,
  };
}

export async function upsertWeeklyPlanPublicationState(args: {
  tenantId: string;
  weekId: string;
  variantLabel: string;
  isPublished: boolean;
  publishedByUserId?: string | null;
}) {
  if (!args.tenantId) {
    throw new Error("tenantId is required.");
  }

  const trimmedLabel = args.variantLabel.trim();

  if (!trimmedLabel) {
    throw new Error("variantLabel is required.");
  }

  getWeekRangeFromWeekId(args.weekId);

  return prisma.wochenplanPublication.upsert({
    where: {
      tenantId_weekId: {
        tenantId: args.tenantId,
        weekId: args.weekId,
      },
    },
    create: {
      tenantId: args.tenantId,
      weekId: args.weekId,
      variantLabel: trimmedLabel,
      isPublished: args.isPublished,
      publishedAt: args.isPublished ? new Date() : null,
      publishedByUserId: args.isPublished ? args.publishedByUserId ?? null : null,
    },
    update: {
      variantLabel: trimmedLabel,
      isPublished: args.isPublished,
      publishedAt: args.isPublished ? new Date() : null,
      publishedByUserId: args.isPublished ? args.publishedByUserId ?? null : null,
    },
  });
}
