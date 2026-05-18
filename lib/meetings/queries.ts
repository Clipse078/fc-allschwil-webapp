import { prisma } from "@/lib/db/prisma";

export async function getMeetings() {
  return prisma.meeting.findMany({
    orderBy: { meetingDate: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      meetingDate: true,
      location: true,
      attendeeCount: true,
      status: true,
      reviewStage: true,
      requiresFourEyeReview: true,
    },
  });
}

export async function getMeetingBySlug(slug: string) {
  return prisma.meeting.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      meetingDate: true,
      location: true,
      attendeeCount: true,
      status: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getMeetingById(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      meetingDate: true,
      location: true,
      attendeeCount: true,
      status: true,
      reviewStage: true,
      requiresFourEyeReview: true,
      reviewedByUserId: true,
      reviewedAt: true,
    },
  });
}

export type MeetingListItem = Awaited<ReturnType<typeof getMeetings>>[number];
export type MeetingDetail = Awaited<ReturnType<typeof getMeetingBySlug>>;

/**
 * Non-null meeting from getMeetingBySlug — used as prop type across
 * detail sub-cards so they can display live DB data when available.
 */
export type MeetingLiveData = NonNullable<MeetingDetail>;
