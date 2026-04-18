import { prisma } from "@/lib/db/prisma";

export type EventListFilter = "ALL" | "MATCH" | "TOURNAMENT" | "TRAINING" | "OTHER";

export async function getEventsListData(filter: EventListFilter = "ALL") {
  const where =
    filter === "ALL"
      ? {}
      : {
          type: filter,
        };

  const events = await prisma.event.findMany({
    where,
    orderBy: [
      { startAt: "asc" },
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startAt: true,
      endAt: true,
      type: true,
      source: true,
      status: true,
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: true,
      wochenplanVisible: true,
      trainingsplanVisible: true,
      teamPageVisible: true,
      opponentName: true,
      organizerName: true,
      competitionLabel: true,
      homeAway: true,
      resultLabel: true,
      season: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          ageGroup: true,
        },
      },
    },
  });

  return events;
}