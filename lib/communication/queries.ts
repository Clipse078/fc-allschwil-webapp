import { prisma } from "@/lib/db/prisma";

export async function getCommunicationTemplates(actorUserId?: string) {
  return prisma.communicationTemplate.findMany({
    where: {
      OR: [
        { visibilityScope: "ORGANISATION" },
        ...(actorUserId ? [{ createdByUserId: actorUserId }] : []),
      ],
    },
    orderBy: [{ status: "asc" }, { category: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      status: true,
      moduleKey: true,
      reviewStage: true,
      subject: true,
      createdAt: true,
    },
  });
}

export async function getCommunicationTemplateBySlug(slug: string) {
  return prisma.communicationTemplate.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      status: true,
      moduleKey: true,
      subject: true,
      bodyMarkdown: true,
      variableRefs: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      visibilityScope: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type CommunicationTemplateListItem = Awaited<ReturnType<typeof getCommunicationTemplates>>[number];
export type CommunicationTemplateDetail = Awaited<ReturnType<typeof getCommunicationTemplateBySlug>>;
