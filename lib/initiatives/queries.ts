import { prisma } from "@/lib/db/prisma";

export async function getInitiatives() {
  return prisma.initiative.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      owner: true,
      progress: true,
      dueDate: true,
      reviewStage: true,
      requiresFourEyeReview: true,
    },
  });
}

export async function getInitiativeBySlug(slug: string) {
  return prisma.initiative.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      status: true,
      owner: true,
      progress: true,
      dueDate: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getInitiativeById(id: string) {
  return prisma.initiative.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      status: true,
      owner: true,
      progress: true,
      dueDate: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
    },
  });
}

export type InitiativeListItem = Awaited<ReturnType<typeof getInitiatives>>[number];
export type InitiativeDetail = Awaited<ReturnType<typeof getInitiativeBySlug>>;
