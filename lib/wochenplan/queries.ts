/**
 * lib/wochenplan/queries.ts
 *
 * DB query layer for the Wochenplan (Week Planner) field grid.
 *
 * Loads Event rows for a given ISO week and maps them into
 * WochenplanBoardEvent objects that the board component can render.
 *
 * Events that fall outside Mon–Fri or outside the four standard
 * time slots (15:45–17:15, 17:15–18:45, 18:45–20:15, 20:15–21:45)
 * are returned in the `unplaced` list — the board does not display
 * them but the page can show them as a sidebar.
 */
import { prisma } from "@/lib/db/prisma";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
  WochenplanBoardPitchRowKey,
  WochenplanBoardSlotKey,
  WochenplanBoardCategoryKey,
} from "@/lib/wochenplan/types";

// ── Slot snap ────────────────────────────────────────────────────────────────

const SLOT_BOUNDARIES: { slot: WochenplanBoardSlotKey; startMin: number; endMin: number }[] = [
  { slot: "15:45-17:15", startMin: 15 * 60 + 45, endMin: 17 * 60 + 15 },
  { slot: "17:15-18:45", startMin: 17 * 60 + 15, endMin: 18 * 60 + 45 },
  { slot: "18:45-20:15", startMin: 18 * 60 + 45, endMin: 20 * 60 + 15 },
  { slot: "20:15-21:45", startMin: 20 * 60 + 15, endMin: 21 * 60 + 45 },
];

function snapToSlot(date: Date): WochenplanBoardSlotKey | null {
  const minutesInDay = date.getUTCHours() * 60 + date.getUTCMinutes();
  let best: { slot: WochenplanBoardSlotKey; distance: number } | null = null;
  for (const { slot, startMin } of SLOT_BOUNDARIES) {
    const distance = Math.abs(minutesInDay - startMin);
    if (!best || distance < best.distance) {
      best = { slot, distance };
    }
  }
  // Accept if within 45 minutes of a slot start
  if (best && best.distance <= 45) return best.slot;
  return null;
}

// ── Day key ──────────────────────────────────────────────────────────────────

const ISO_WEEKDAY_TO_DAY: Record<number, WochenplanBoardDayKey> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

function toDayKey(date: Date): WochenplanBoardDayKey | null {
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return ISO_WEEKDAY_TO_DAY[isoWeekday] ?? null;
}

// ── Pitch code → board fields ─────────────────────────────────────────────────

type PitchBoardFields = {
  pitchRowKey: WochenplanBoardPitchRowKey;
  fieldLabel: "A" | "B" | null;
};

function parsePitchCode(code: string | null | undefined): PitchBoardFields | null {
  if (!code) return null;
  if (code === "STADION") return { pitchRowKey: "STADION", fieldLabel: null };
  if (code === "STADION_A") return { pitchRowKey: "STADION", fieldLabel: "A" };
  if (code === "STADION_B") return { pitchRowKey: "STADION", fieldLabel: "B" };
  if (code === "KUNSTRASEN_2") return { pitchRowKey: "KUNSTRASEN_2", fieldLabel: null };
  if (code === "KUNSTRASEN_2_A") return { pitchRowKey: "KUNSTRASEN_2", fieldLabel: "A" };
  if (code === "KUNSTRASEN_2_B") return { pitchRowKey: "KUNSTRASEN_2", fieldLabel: "B" };
  if (code === "KUNSTRASEN_3") return { pitchRowKey: "KUNSTRASEN_3", fieldLabel: null };
  if (code === "KUNSTRASEN_3_A") return { pitchRowKey: "KUNSTRASEN_3", fieldLabel: "A" };
  if (code === "KUNSTRASEN_3_B") return { pitchRowKey: "KUNSTRASEN_3", fieldLabel: "B" };
  return null;
}

// ── Category mapping ──────────────────────────────────────────────────────────

function toCategoryKey(teamCategory: string | null | undefined): WochenplanBoardCategoryKey {
  if (!teamCategory) return "JUNIOREN";
  const upper = teamCategory.toUpperCase();
  if (upper.includes("KINDER") || upper.includes("F1") || upper.includes("F2") || upper.includes("E")) return "KINDERFUSSBALL";
  if (upper.includes("FRAUEN") || upper.includes("WOMEN")) return "FRAUEN";
  if (upper.includes("AKTIV") || upper.includes("1.") || upper.includes("PROMO")) return "AKTIVE";
  if (upper.includes("SENIOR")) return "SENIOREN";
  if (upper.includes("TRAINER") || upper.includes("STAFF")) return "TRAINER";
  return "JUNIOREN";
}

// ── Prisma select ─────────────────────────────────────────────────────────────

const BOARD_EVENT_SELECT = {
  id: true,
  title: true,
  type: true,
  source: true,
  status: true,
  startAt: true,
  endAt: true,
  location: true,
  opponentName: true,
  organizerName: true,
  competitionLabel: true,
  pitchCode: true,
  homeDressingRoomCode: true,
  awayDressingRoomCode: true,
  wochenplanVisible: true,
  websiteVisible: true,
  infoboardVisible: true,
  team: {
    select: {
      id: true,
      name: true,
      category: true,
    },
  },
} as const;

type BoardEventRow = {
  id: string;
  title: string;
  type: string;
  source: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  wochenplanVisible: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  team: { id: string; name: string; category: string } | null;
};

// ── Public types ──────────────────────────────────────────────────────────────

export type WochenplanBoardData = {
  placed: WochenplanBoardEvent[];
  /** Events in this week that cannot be placed on the grid (weekend, unusual times, etc.) */
  unplaced: Array<{
    id: string;
    title: string;
    type: string;
    startAt: string;
    teamName: string | null;
    reason: "WEEKEND" | "NO_SLOT" | "NO_PITCH";
  }>;
  weekId: string;
};

export type WochenplanAllocationRow = {
  id: string;
  title: string;
  type: string;
  startAt: string;
  teamName: string | null;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  wochenplanVisible: boolean;
};

// ── Main query ────────────────────────────────────────────────────────────────

/**
 * Loads all Events in the given ISO week, maps them to board placements.
 * Events without pitch allocation are placed in the first matching slot by time;
 * events that cannot fit the board go to `unplaced`.
 */
export async function getWochenplanBoardData(
  weekStart: Date,
  weekEnd: Date,
  weekId: string,
): Promise<WochenplanBoardData> {
  const events = await prisma.event.findMany({
    where: {
      startAt: { gte: weekStart, lte: weekEnd },
      status: { in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"] },
    },
    orderBy: [{ startAt: "asc" }],
    select: BOARD_EVENT_SELECT,
  });

  const placed: WochenplanBoardEvent[] = [];
  const unplaced: WochenplanBoardData["unplaced"] = [];

  for (const event of events as unknown as BoardEventRow[]) {
    const dayKey = toDayKey(event.startAt);
    if (!dayKey) {
      unplaced.push({
        id: event.id,
        title: event.title,
        type: event.type,
        startAt: event.startAt.toISOString(),
        teamName: event.team?.name ?? null,
        reason: "WEEKEND",
      });
      continue;
    }

    const slotKey = snapToSlot(event.startAt);
    if (!slotKey) {
      unplaced.push({
        id: event.id,
        title: event.title,
        type: event.type,
        startAt: event.startAt.toISOString(),
        teamName: event.team?.name ?? null,
        reason: "NO_SLOT",
      });
      continue;
    }

    // Derive pitch placement: from saved pitchCode or default STADION
    const pitchFields = parsePitchCode(event.pitchCode) ?? {
      pitchRowKey: "KUNSTRASEN_2" as WochenplanBoardPitchRowKey,
      fieldLabel: null,
    };

    placed.push({
      id: event.id,
      title: event.title,
      eventType: event.type,
      source: event.source,
      status: event.status,
      teamName: event.team?.name ?? null,
      opponentName: event.opponentName,
      organizerName: event.organizerName,
      competitionLabel: event.competitionLabel,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt?.toISOString() ?? null,
      location: event.location,
      boardDayKey: dayKey,
      slotKey,
      pitchRowKey: pitchFields.pitchRowKey,
      fieldLabel: pitchFields.fieldLabel,
      homeLabel: null,
      coachLabel: null,
      categoryKey: toCategoryKey(event.team?.category),
      allocation: {
        pitchCode: event.pitchCode,
        homeDressingRoomCode: event.homeDressingRoomCode,
        awayDressingRoomCode: event.awayDressingRoomCode,
        publishedToWebsite: event.websiteVisible,
        publishedToInfoboard: event.infoboardVisible,
      },
    });
  }

  return { placed, unplaced, weekId };
}

/**
 * Returns a flat list of all events in the week for the publish confirmation.
 */
export async function getWochenplanWeekEventIds(
  weekStart: Date,
  weekEnd: Date,
): Promise<string[]> {
  const events = await prisma.event.findMany({
    where: {
      startAt: { gte: weekStart, lte: weekEnd },
      status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
    },
    select: { id: true },
  });
  return events.map((e) => e.id);
}
