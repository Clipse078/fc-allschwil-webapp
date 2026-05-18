import { prisma } from "@/lib/db/prisma";

export async function getTargets() {
  return prisma.target.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      startsAt: true,
      endsAt: true,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export async function getTargetById(id: string) {
  return prisma.target.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      period: true,
      periodLabel: true,
      moduleKey: true,
      sportCategory: true,
      ageGroupHint: true,
      startsAt: true,
      endsAt: true,
      nudgeJson: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      metrics: {
        select: {
          id: true,
          label: true,
          type: true,
          direction: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          notes: true,
          sortOrder: true,
          dataPoints: {
            select: {
              id: true,
              value: true,
              note: true,
              measuredAt: true,
            },
            orderBy: { measuredAt: "desc" },
            take: 10,
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export type TargetListItem = Awaited<ReturnType<typeof getTargets>>[number];
export type TargetDetail = Awaited<ReturnType<typeof getTargetById>>;
export type TargetMetricWithDataPoints = NonNullable<TargetDetail>["metrics"][number];
