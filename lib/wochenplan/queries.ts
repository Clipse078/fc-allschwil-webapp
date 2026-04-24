import { PlanningResourceType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPlanningWeekWindow } from "@/lib/planning/week-window";
import type {
  WochenplanBoardCategoryKey,
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
  WochenplanBoardPitchRowKey,
  WochenplanBoardSlotKey,
} from "@/lib/wochenplan/types";

function toBoardDayKey(date: Date): WochenplanBoardDayKey {
  const day = date.getDay();
  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  if (day === 6) return "SATURDAY";
  return "SUNDAY";
}

function toSlotKey(date: Date): WochenplanBoardSlotKey {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60) return "08:00-10:00";
  if (minutes < 12 * 60) return "10:00-12:00";
  if (minutes < 14 * 60) return "12:00-14:00";
  if (minutes < 17 * 60 + 15) return "15:45-17:15";
  if (minutes < 18 * 60 + 45) return "17:15-18:45";
  if (minutes < 20 * 60 + 15) return "18:45-20:15";
  return "20:15-21:45";
}

function toPitchRowKey(resourceKey: string | null): WochenplanBoardPitchRowKey {
  if (resourceKey?.startsWith("kunstrasen-2")) return "KUNSTRASEN_2";
  if (resourceKey?.startsWith("kunstrasen-3")) return "KUNSTRASEN_3";
  return "STADION";
}

function toFieldLabel(resourceKey: string | null): "A" | "B" | null {
  if (resourceKey?.endsWith("-feld-a")) return "A";
  if (resourceKey?.endsWith("-feld-b")) return "B";
  return null;
}

function toPitchCode(resourceKey: string | null, eventType: string) {
  if (!resourceKey) return null;
  if (resourceKey === "stadion-feld-a") return eventType === "TRAINING" ? "STADION_A" : "STADION";
  if (resourceKey === "stadion-feld-b") return eventType === "TRAINING" ? "STADION_B" : "STADION";
  if (resourceKey === "kunstrasen-2-feld-a") return eventType === "TRAINING" ? "KUNSTRASEN_2_A" : "KUNSTRASEN_2";
  if (resourceKey === "kunstrasen-2-feld-b") return eventType === "TRAINING" ? "KUNSTRASEN_2_B" : "KUNSTRASEN_2";
  if (resourceKey === "kunstrasen-3-feld-a") return eventType === "TRAINING" ? "KUNSTRASEN_3_A" : "KUNSTRASEN_3";
  if (resourceKey === "kunstrasen-3-feld-b") return eventType === "TRAINING" ? "KUNSTRASEN_3_B" : "KUNSTRASEN_3";
  return null;
}

function toRoomCode(resourceKey: string | null) {
  if (!resourceKey) return null;
  return resourceKey.replace("garderobe-", "").toUpperCase();
}

function toCategoryKey(category: string | null | undefined): WochenplanBoardCategoryKey {
  if (category === "KINDERFUSSBALL") return "KINDERFUSSBALL";
  if (category === "JUNIOREN") return "JUNIOREN";
  if (category === "AKTIVE") return "AKTIVE";
  if (category === "FRAUEN") return "FRAUEN";
  if (category === "SENIOREN") return "SENIOREN";
  if (category === "TRAININGSGRUPPE") return "TRAININGSGRUPPE";
  return "TRAINER";
}

function getWeekWindow(weekOffset?: number | null) {
  return getPlanningWeekWindow({ weekOffset });
}

export async function getWochenplanBoardData(args?: { weekOffset?: number | null }): Promise<{ events: WochenplanBoardEvent[]; weekWindow: ReturnType<typeof getPlanningWeekWindow> }> {
  const weekWindow = getWeekWindow(args?.weekOffset);
  const { start, end } = weekWindow;

  const events = await prisma.event.findMany({
    where: { wochenplanVisible: true, startAt: { gte: start, lte: end } },
    orderBy: [{ startAt: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true, title: true, type: true, source: true, status: true, startAt: true, endAt: true,
      location: true, opponentName: true, organizerName: true, competitionLabel: true,
      websiteVisible: true, infoboardVisible: true,
      team: { select: { name: true, category: true } },
      planningAllocations: { select: { label: true, resource: { select: { key: true, type: true } } } },
    },
  });

  const mappedEvents = events.map((event) => {
    const pitchAllocation = event.planningAllocations.find((allocation) => allocation.resource.type === PlanningResourceType.PITCH);
    const homeRoomAllocation = event.planningAllocations.find((allocation) => allocation.resource.type === PlanningResourceType.DRESSING_ROOM && allocation.label !== "Gegner");
    const awayRoomAllocation = event.planningAllocations.find((allocation) => allocation.resource.type === PlanningResourceType.DRESSING_ROOM && allocation.label === "Gegner");
    const pitchKey = pitchAllocation?.resource.key ?? null;

    return {
      id: event.id,
      title: event.team?.name ?? event.title,
      eventType: event.type,
      source: event.source,
      status: event.status,
      teamName: event.team?.name ?? null,
      opponentName: event.opponentName,
      organizerName: event.organizerName,
      competitionLabel: event.competitionLabel,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      boardDayKey: toBoardDayKey(event.startAt),
      slotKey: toSlotKey(event.startAt),
      pitchRowKey: toPitchRowKey(pitchKey),
      fieldLabel: toFieldLabel(pitchKey),
      homeLabel: event.team?.name ?? event.title,
      coachLabel: null,
      categoryKey: toCategoryKey(event.team?.category),
      allocation: {
        pitchCode: toPitchCode(pitchKey, event.type),
        homeDressingRoomCode: toRoomCode(homeRoomAllocation?.resource.key ?? null),
        awayDressingRoomCode: toRoomCode(awayRoomAllocation?.resource.key ?? null),
        publishedToWebsite: event.websiteVisible,
        publishedToInfoboard: event.infoboardVisible,
      },
    } satisfies WochenplanBoardEvent;
  });

  return {
    events: mappedEvents,
    weekWindow,
  };
}




