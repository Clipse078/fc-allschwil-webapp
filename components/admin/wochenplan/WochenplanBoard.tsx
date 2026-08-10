"use client";

import { useMemo, useState } from "react";
import WochenplanConflictPanel from "@/components/admin/wochenplan/WochenplanConflictPanel";
import WochenplanDayGrid from "@/components/admin/wochenplan/WochenplanDayGrid";
import WochenplanLegend from "@/components/admin/wochenplan/WochenplanLegend";
import WochenplanPublishBar from "@/components/admin/wochenplan/WochenplanPublishBar";
import WochenplanRoomDayPlannerDialog, {
  type WochenplanRoomConflictPair,
} from "@/components/admin/wochenplan/WochenplanRoomDayPlannerDialog";
import WochenplanRoomDrawer from "@/components/admin/wochenplan/WochenplanRoomDrawer";
import { getWochenplanConflicts } from "@/lib/wochenplan/conflict-engine";
import { parseIsoWeekId } from "@/lib/planner/date-utils";
import { withRequiredCodes, type FacilityResourceOption } from "@/lib/facilities/resource-options";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
  WochenplanBoardPitchRowKey,
  WochenplanBoardSlotKey,
  WochenplanEventItem,
} from "@/lib/wochenplan/types";

const DEFAULT_PITCH_ROWS: Array<{ key: WochenplanBoardPitchRowKey; label: string }> = [
  { key: "STADION", label: "Stadion" },
  { key: "KUNSTRASEN_2", label: "KR 2" },
  { key: "KUNSTRASEN_3", label: "KR 3" },
];

/**
 * Fallback dressing-room options used only when no tenant-scoped
 * `roomOptions` prop is supplied (e.g. the standalone demo-data mode below).
 * Real usage (app/(admin)/dashboard/wochenplan/page.tsx) always resolves
 * canonical options via getActiveResourceOptionsForTenant(tenantId,
 * "DRESSING_ROOM"), mirroring the DEFAULT_PITCH_ROWS fallback pattern above.
 */
const DEFAULT_DRESSING_ROOMS: FacilityResourceOption[] = [
  { code: "E1", name: "E1" },
  { code: "E2", name: "E2" },
  { code: "E3", name: "E3" },
  { code: "E4", name: "E4" },
  { code: "O1", name: "O1" },
  { code: "O2", name: "O2" },
  { code: "O3", name: "O3" },
  { code: "O4", name: "O4" },
];

const TIME_SLOTS: WochenplanBoardSlotKey[] = [
  "15:45-17:15",
  "17:15-18:45",
  "18:45-20:15",
  "20:15-21:45",
];

const DAYS: Array<{ key: WochenplanBoardDayKey; label: string }> = [
  { key: "MONDAY", label: "Montag" },
  { key: "TUESDAY", label: "Dienstag" },
  { key: "WEDNESDAY", label: "Mittwoch" },
  { key: "THURSDAY", label: "Donnerstag" },
  { key: "FRIDAY", label: "Freitag" },
];

function getSlotStartHour(slotKey: WochenplanBoardSlotKey) {
  if (slotKey === "15:45-17:15") {
    return { hour: 15, minute: 45, endHour: 17, endMinute: 15 };
  }

  if (slotKey === "17:15-18:45") {
    return { hour: 17, minute: 15, endHour: 18, endMinute: 45 };
  }

  if (slotKey === "18:45-20:15") {
    return { hour: 18, minute: 45, endHour: 20, endMinute: 15 };
  }

  return { hour: 20, minute: 15, endHour: 21, endMinute: 45 };
}

function getBoardDate(dayKey: WochenplanBoardDayKey, weekStart: Date | null): string {
  // If no weekStart is available, fall back to a known Monday.
  const base = weekStart ?? new Date("2026-04-13T00:00:00.000Z");
  const DAY_OFFSET: Record<WochenplanBoardDayKey, number> = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
  };
  const d = new Date(base.getTime() + DAY_OFFSET[dayKey] * 86400000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBoardDayLabel(dayKey: WochenplanBoardDayKey, dayLabel: string, weekStart: Date | null) {
  const date = new Date(getBoardDate(dayKey, weekStart) + "T12:00:00Z");
  const formattedDate = new Intl.DateTimeFormat("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(date);

  return dayLabel + " " + formattedDate;
}

function createIsoDateTime(
  dayKey: WochenplanBoardDayKey,
  slotKey: WochenplanBoardSlotKey,
  end: boolean,
  weekStart: Date | null = null,
) {
  const date = getBoardDate(dayKey, weekStart);
  const slot = getSlotStartHour(slotKey);
  const hour = end ? slot.endHour : slot.hour;
  const minute = end ? slot.endMinute : slot.minute;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  return date + "T" + hh + ":" + mm + ":00.000Z";
}

function toPitchCode(event: WochenplanBoardEvent) {
  if (event.eventType === "TRAINING") {
    if (event.pitchRowKey === "STADION") {
      return event.fieldLabel === "B" ? "STADION_B" : "STADION_A";
    }

    if (event.pitchRowKey === "KUNSTRASEN_2") {
      return event.fieldLabel === "B" ? "KUNSTRASEN_2_B" : "KUNSTRASEN_2_A";
    }

    return event.fieldLabel === "B" ? "KUNSTRASEN_3_B" : "KUNSTRASEN_3_A";
  }

  return event.pitchRowKey;
}

function toConflictEvent(event: WochenplanBoardEvent): WochenplanEventItem {
  return {
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    source: event.source,
    status: event.status,
    teamName: event.teamName,
    opponentName: event.opponentName,
    organizerName: event.organizerName,
    competitionLabel: event.competitionLabel,
    startAt: createIsoDateTime(event.boardDayKey, event.slotKey, false),
    endAt: createIsoDateTime(event.boardDayKey, event.slotKey, true),
    location: event.location,
    allocation: {
      ...event.allocation,
      pitchCode: toPitchCode(event),
    },
  };
}

function getMinutesFromValue(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function hasTimeOverlap(
  firstStart: string | Date | null | undefined,
  firstEnd: string | Date | null | undefined,
  secondStart: string | Date | null | undefined,
  secondEnd: string | Date | null | undefined,
) {
  const firstStartMinutes = getMinutesFromValue(firstStart);
  const firstEndMinutes = getMinutesFromValue(firstEnd);
  const secondStartMinutes = getMinutesFromValue(secondStart);
  const secondEndMinutes = getMinutesFromValue(secondEnd);

  return firstStartMinutes < secondEndMinutes && secondStartMinutes < firstEndMinutes;
}

function getRoomConflictPairs(events: WochenplanBoardEvent[]): WochenplanRoomConflictPair[] {
  const pairs: WochenplanRoomConflictPair[] = [];

  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const first = events[i];
      const second = events[j];

      if (first.boardDayKey !== second.boardDayKey) {
        continue;
      }

      if (!hasTimeOverlap(first.startAt, first.endAt, second.startAt, second.endAt)) {
        continue;
      }

      const firstRooms = [
        first.allocation.homeDressingRoomCode,
        first.allocation.awayDressingRoomCode,
      ].filter(Boolean) as string[];

      const secondRooms = [
        second.allocation.homeDressingRoomCode,
        second.allocation.awayDressingRoomCode,
      ].filter(Boolean) as string[];

      for (const firstRoom of firstRooms) {
        for (const secondRoom of secondRooms) {
          if (firstRoom !== secondRoom) {
            continue;
          }

          pairs.push({
            roomCode: firstRoom,
            eventId: first.id,
            otherEventId: second.id,
          });
        }
      }
    }
  }

  return pairs;
}

function buildDemoEvents(): WochenplanBoardEvent[] {
  return [
    {
      id: "monday-e4-training",
      title: "E4",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "E4",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("MONDAY", "15:45-17:15", false),
      endAt: createIsoDateTime("MONDAY", "15:45-17:15", true),
      location: "Kunstrasen 3",
      boardDayKey: "MONDAY",
      slotKey: "15:45-17:15",
      pitchRowKey: "KUNSTRASEN_3",
      fieldLabel: "B",
      homeLabel: "M. Duijster",
      coachLabel: "M. Duijster",
      categoryKey: "KINDERFUSSBALL",
      allocation: {
        pitchCode: "KUNSTRASEN_3_B",
        homeDressingRoomCode: "E1",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "monday-f1-training",
      title: "F1",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "F1",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("MONDAY", "15:45-17:15", false),
      endAt: createIsoDateTime("MONDAY", "15:45-17:15", true),
      location: "Kunstrasen 3",
      boardDayKey: "MONDAY",
      slotKey: "15:45-17:15",
      pitchRowKey: "KUNSTRASEN_3",
      fieldLabel: "A",
      homeLabel: "R. Schmid",
      coachLabel: "R. Schmid",
      categoryKey: "KINDERFUSSBALL",
      allocation: {
        pitchCode: "KUNSTRASEN_3_A",
        homeDressingRoomCode: "E4",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "monday-a-junioren",
      title: "A-Junioren",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "A-Junioren",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("MONDAY", "17:15-18:45", false),
      endAt: createIsoDateTime("MONDAY", "17:15-18:45", true),
      location: "Kunstrasen 2",
      boardDayKey: "MONDAY",
      slotKey: "17:15-18:45",
      pitchRowKey: "KUNSTRASEN_2",
      fieldLabel: "A",
      homeLabel: "Feld A",
      coachLabel: "R. Keller",
      categoryKey: "JUNIOREN",
      allocation: {
        pitchCode: "KUNSTRASEN_2_A",
        homeDressingRoomCode: "O2",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "monday-1-frauen",
      title: "1. Liga Frauen",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "1. Liga Frauen",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("MONDAY", "20:15-21:45", false),
      endAt: createIsoDateTime("MONDAY", "20:15-21:45", true),
      location: "Kunstrasen 3",
      boardDayKey: "MONDAY",
      slotKey: "20:15-21:45",
      pitchRowKey: "KUNSTRASEN_3",
      fieldLabel: "A",
      homeLabel: "E. Vögt",
      coachLabel: "E. Vögt",
      categoryKey: "FRAUEN",
      allocation: {
        pitchCode: "KUNSTRASEN_3_A",
        homeDressingRoomCode: "E2",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "monday-first-team",
      title: "1. Mannschaft",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "1. Mannschaft",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("MONDAY", "20:15-21:45", false),
      endAt: createIsoDateTime("MONDAY", "20:15-21:45", true),
      location: "Stadion",
      boardDayKey: "MONDAY",
      slotKey: "20:15-21:45",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld C",
      coachLabel: "R. Galli",
      categoryKey: "AKTIVE",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "E1",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "tuesday-2-frauen",
      title: "2. Liga Frauen",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "2. Liga Frauen",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("TUESDAY", "20:15-21:45", false),
      endAt: createIsoDateTime("TUESDAY", "20:15-21:45", true),
      location: "Stadion",
      boardDayKey: "TUESDAY",
      slotKey: "20:15-21:45",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "S. Du...",
      categoryKey: "FRAUEN",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "E1",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "tuesday-2-team-match",
      title: "2. Mannschaft",
      eventType: "MATCH",
      source: "CLUBCORNER_FVNWS",
      status: "SCHEDULED",
      teamName: "2. Mannschaft",
      opponentName: "FC Muttenz",
      organizerName: null,
      competitionLabel: "Res. Spiele",
      startAt: createIsoDateTime("TUESDAY", "20:15-21:45", false),
      endAt: createIsoDateTime("TUESDAY", "20:15-21:45", true),
      location: "Kunstrasen 3",
      boardDayKey: "TUESDAY",
      slotKey: "20:15-21:45",
      pitchRowKey: "KUNSTRASEN_3",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "M. Suter",
      categoryKey: "AKTIVE",
      allocation: {
        pitchCode: "KUNSTRASEN_3",
        homeDressingRoomCode: "E2",
        awayDressingRoomCode: "O2",
        publishedToWebsite: true,
        publishedToInfoboard: true,
      },
    },
    {
      id: "wednesday-goalie",
      title: "Torwart (TG)",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "Torwarttraining",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("WEDNESDAY", "17:15-18:45", false),
      endAt: createIsoDateTime("WEDNESDAY", "17:15-18:45", true),
      location: "Stadion",
      boardDayKey: "WEDNESDAY",
      slotKey: "17:15-18:45",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "P. Huser",
      categoryKey: "TRAINER",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "O1",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "wednesday-first-team-match",
      title: "1. Mannschaft",
      eventType: "MATCH",
      source: "CLUBCORNER_FVNWS",
      status: "SCHEDULED",
      teamName: "1. Mannschaft",
      opponentName: "BSC Old Boys",
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("WEDNESDAY", "18:45-20:15", false),
      endAt: createIsoDateTime("WEDNESDAY", "18:45-20:15", true),
      location: "Stadion",
      boardDayKey: "WEDNESDAY",
      slotKey: "18:45-20:15",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "R. Galli",
      categoryKey: "AKTIVE",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "E1",
        awayDressingRoomCode: "O1",
        publishedToWebsite: true,
        publishedToInfoboard: true,
      },
    },
    {
      id: "thursday-second-team",
      title: "2. Mannschaft",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "2. Mannschaft",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("THURSDAY", "18:45-20:15", false),
      endAt: createIsoDateTime("THURSDAY", "18:45-20:15", true),
      location: "Stadion",
      boardDayKey: "THURSDAY",
      slotKey: "18:45-20:15",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "M. Suter",
      categoryKey: "AKTIVE",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "E2",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "friday-first-team",
      title: "1. Mannschaft",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "1. Mannschaft",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("FRIDAY", "18:45-20:15", false),
      endAt: createIsoDateTime("FRIDAY", "18:45-20:15", true),
      location: "Stadion",
      boardDayKey: "FRIDAY",
      slotKey: "18:45-20:15",
      pitchRowKey: "STADION",
      fieldLabel: null,
      homeLabel: "Feld A",
      coachLabel: "R. Galli",
      categoryKey: "AKTIVE",
      allocation: {
        pitchCode: "STADION",
        homeDressingRoomCode: "E1",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
    {
      id: "friday-d9",
      title: "D9 1",
      eventType: "TRAINING",
      source: "MANUAL",
      status: "SCHEDULED",
      teamName: "D9 1",
      opponentName: null,
      organizerName: null,
      competitionLabel: null,
      startAt: createIsoDateTime("FRIDAY", "20:15-21:45", false),
      endAt: createIsoDateTime("FRIDAY", "20:15-21:45", true),
      location: "Kunstrasen 3",
      boardDayKey: "FRIDAY",
      slotKey: "20:15-21:45",
      pitchRowKey: "KUNSTRASEN_3",
      fieldLabel: "A",
      homeLabel: "Feld B",
      coachLabel: "R. Frei",
      categoryKey: "JUNIOREN",
      allocation: {
        pitchCode: "KUNSTRASEN_3_A",
        homeDressingRoomCode: "O4",
        awayDressingRoomCode: null,
        publishedToWebsite: false,
        publishedToInfoboard: false,
      },
    },
  ];
}

function getNextTrainingField(
  events: WochenplanBoardEvent[],
  targetEventId: string,
  nextDayKey: WochenplanBoardDayKey,
  nextPitchRowKey: WochenplanBoardPitchRowKey,
  nextSlotKey: WochenplanBoardSlotKey,
) {
  const occupied = events
    .filter(
      (event) =>
        event.id !== targetEventId &&
        event.eventType === "TRAINING" &&
        event.boardDayKey === nextDayKey &&
        event.pitchRowKey === nextPitchRowKey &&
        event.slotKey === nextSlotKey,
    )
    .map((event) => event.fieldLabel)
    .filter(Boolean);

  if (!occupied.includes("A")) {
    return "A";
  }

  if (!occupied.includes("B")) {
    return "B";
  }

  return "A";
}

function buildSnapshot(events: WochenplanBoardEvent[]) {
  return JSON.stringify(
    events.map((event) => ({
      id: event.id,
      boardDayKey: event.boardDayKey,
      pitchRowKey: event.pitchRowKey,
      slotKey: event.slotKey,
      fieldLabel: event.fieldLabel,
      homeDressingRoomCode: event.allocation.homeDressingRoomCode,
      awayDressingRoomCode: event.allocation.awayDressingRoomCode,
    })),
  );
}

type WochenplanBoardProps = {
  /** Real events loaded from the database. Falls back to demo data when absent. */
  initialEvents?: WochenplanBoardEvent[];
  /** ISO week identifier (e.g. "2026-W23") used for publish API call. */
  weekId?: string;
  /**
   * Pitch row labels resolved via the canonical facility/resource display helper.
   * Falls back to DEFAULT_PITCH_ROWS (static FCA registry labels) when not provided.
   */
  pitchRows?: Array<{ key: WochenplanBoardPitchRowKey; label: string }>;
  /**
   * The currently active plan variant label for this week (from WochenplanPublication).
   * Shown in the publish bar as "KW N | Variantname aktiv".
   */
  activeVariantLabel?: string | null;
  /**
   * MASTERDATA-CONSISTENCY-02 — canonical, tenant-scoped, ACTIVE-ONLY
   * dressing-room options resolved via getActiveResourceOptionsForTenant(
   * tenantId, "DRESSING_ROOM"). Falls back to DEFAULT_DRESSING_ROOMS when
   * not provided (demo-data mode).
   *
   * MASTERDATA-CONSISTENCY-02-C2 — this list is intentionally NOT
   * pre-merged with historical/archived codes for the whole week anymore.
   * Historical compatibility is derived narrowly below (per-event for the
   * Room Drawer, per-day for the Day Planner dialog) using
   * historicalRoomNamesByCode, so an archived room referenced on one day
   * never bleeds into another day's/event's selectable options.
   */
  roomOptions?: FacilityResourceOption[];
  /**
   * MASTERDATA-CONSISTENCY-02-C2 — display names (resolved server-side,
   * status-independent) for every dressing-room code referenced by any
   * placed event this week, keyed by code. Used only to label a historical
   * code when it is merged back into a narrowly-scoped options list below —
   * never to decide availability. Falls back to the raw code when a code
   * has no entry here (e.g. no DB resource can be resolved at all).
   */
  historicalRoomNamesByCode?: Record<string, string>;
};

export default function WochenplanBoard({
  initialEvents,
  weekId,
  pitchRows: pitchRowsProp,
  activeVariantLabel,
  roomOptions: roomOptionsProp,
  historicalRoomNamesByCode: historicalRoomNamesByCodeProp,
}: WochenplanBoardProps) {
  const PITCH_ROWS = pitchRowsProp ?? DEFAULT_PITCH_ROWS;
  const ROOM_OPTIONS = roomOptionsProp ?? DEFAULT_DRESSING_ROOMS;
  const historicalRoomNamesByCode = useMemo(
    () => new Map(Object.entries(historicalRoomNamesByCodeProp ?? {})),
    [historicalRoomNamesByCodeProp],
  );
  const [publishedVariant, setPublishedVariant] = useState<string | null>(activeVariantLabel ?? null);
  const weekStart = useMemo(() => (weekId ? parseIsoWeekId(weekId) : null), [weekId]);
  const seedEvents = initialEvents && initialEvents.length > 0 ? initialEvents : buildDemoEvents();
  const [events, setEvents] = useState<WochenplanBoardEvent[]>(seedEvents);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [roomDrawerEventId, setRoomDrawerEventId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dayPlannerState, setDayPlannerState] = useState<{
    dayKey: WochenplanBoardDayKey | null;
    dayLabel: string | null;
  }>({
    dayKey: null,
    dayLabel: null,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialSnapshot = useMemo(() => buildSnapshot(seedEvents), []);
  const currentSnapshot = useMemo(() => buildSnapshot(events), [events]);
  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;

  /**
   * Persist allocation for a single event immediately.
   *
   * MASTERDATA-CONSISTENCY-02-C2 — the server is authoritative: a non-2xx
   * response (e.g. a newly-selected but archived resource, or a rejected
   * cross-tenant/wrong-type code) is no longer treated as a silent success.
   * On rejection, the event is reverted to its prior (already-persisted)
   * state and the existing saveError banner surfaces the server's message,
   * reusing the same minimal error-feedback pattern already used by
   * publishWeek() below — no new toast/notification framework.
   */
  async function persistAllocation(event: WochenplanBoardEvent, previousEvent: WochenplanBoardEvent) {
    const pitchCode = toPitchCode(event);
    try {
      const res = await fetch(`/api/wochenplan/${event.id}/allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchCode,
          homeDressingRoomCode: event.allocation.homeDressingRoomCode,
          awayDressingRoomCode: event.allocation.awayDressingRoomCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? "Zuteilung konnte nicht gespeichert werden.");
        setEvents((current) => current.map((e) => (e.id === event.id ? previousEvent : e)));
        return;
      }

      setSaveError(null);
    } catch {
      setSaveError("Netzwerkfehler. Zuteilung konnte nicht gespeichert werden.");
      setEvents((current) => current.map((e) => (e.id === event.id ? previousEvent : e)));
    }
  }

  /** Publish all board events: set wochenplanVisible = true. */
  async function publishWeek(variantLabel: string) {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const eventIds = events.map((e) => e.id);
      const res = await fetch("/api/wochenplan/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds,
          wochenplanVisible: true,
          weekId,
          variantLabel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? "Fehler beim Publizieren.");
      } else {
        setPublishedVariant(variantLabel);
      }
    } catch {
      setSaveError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  const conflicts = useMemo(() => {
    return getWochenplanConflicts(events.map(toConflictEvent));
  }, [events]);

  const roomConflicts = useMemo(() => {
    return getRoomConflictPairs(events);
  }, [events]);

  const roomDrawerEvent = useMemo(() => {
    return events.find((event) => event.id === roomDrawerEventId) ?? null;
  }, [events, roomDrawerEventId]);

  const occupiedRooms = useMemo(() => {
    if (!roomDrawerEvent) {
      return [];
    }

    const sameSlotEvents = events.filter(
      (event) =>
        event.id !== roomDrawerEvent.id &&
        event.boardDayKey === roomDrawerEvent.boardDayKey &&
        event.slotKey === roomDrawerEvent.slotKey,
    );

    return Array.from(
      new Set(
        sameSlotEvents.flatMap((event) =>
          [
            event.allocation.homeDressingRoomCode,
            event.allocation.awayDressingRoomCode,
          ].filter(Boolean) as string[],
        ),
      ),
    );
  }, [events, roomDrawerEvent]);

  /**
   * MASTERDATA-CONSISTENCY-02-C2 — event-scoped room options for the Room
   * Drawer: canonical active rooms plus only the CURRENTLY OPENED event's
   * own historical/archived codes (never another event's). Derived at this
   * narrow consumer boundary using the existing withRequiredCodes() helper
   * — no new abstraction, no additional query.
   */
  const drawerRoomOptions = useMemo(() => {
    if (!roomDrawerEvent) {
      return ROOM_OPTIONS;
    }

    const requiredCodesForEvent = [
      roomDrawerEvent.allocation.homeDressingRoomCode,
      roomDrawerEvent.allocation.awayDressingRoomCode,
    ];

    return withRequiredCodes(ROOM_OPTIONS, requiredCodesForEvent, historicalRoomNamesByCode);
  }, [ROOM_OPTIONS, roomDrawerEvent, historicalRoomNamesByCode]);

  /**
   * MASTERDATA-CONSISTENCY-02-C2 — day-scoped room options for the Day
   * Planner dialog: canonical active rooms plus only the historical/archived
   * codes referenced by events on the CURRENTLY OPENED day (never another
   * day's events).
   */
  const dayPlannerRoomOptions = useMemo(() => {
    if (!dayPlannerState.dayKey) {
      return ROOM_OPTIONS;
    }

    const requiredCodesForDay = events
      .filter((event) => event.boardDayKey === dayPlannerState.dayKey)
      .flatMap((event) => [event.allocation.homeDressingRoomCode, event.allocation.awayDressingRoomCode]);

    return withRequiredCodes(ROOM_OPTIONS, requiredCodesForDay, historicalRoomNamesByCode);
  }, [ROOM_OPTIONS, events, dayPlannerState.dayKey, historicalRoomNamesByCode]);

  function openDayPlanner(dayKey: WochenplanBoardDayKey, dayLabel: string) {
    setDayPlannerState({
      dayKey,
      dayLabel,
    });
  }

  function handleDropEvent(
    eventId: string,
    nextDayKey: WochenplanBoardDayKey,
    nextPitchRowKey: WochenplanBoardPitchRowKey,
    nextSlotKey: WochenplanBoardSlotKey,
  ) {
    setEvents((current) => {
      const previous = current.find((e) => e.id === eventId) ?? null;

      const next = current.map((event) => {
        if (event.id !== eventId) return event;

        const nextFieldLabel =
          event.eventType === "TRAINING"
            ? (getNextTrainingField(current, event.id, nextDayKey, nextPitchRowKey, nextSlotKey) as "A" | "B" | null)
            : null;

        const resolvedLocation =
          PITCH_ROWS.find((r: { key: string; label: string }) => r.key === nextPitchRowKey)?.label ?? nextPitchRowKey;

        return {
          ...event,
          boardDayKey: nextDayKey,
          pitchRowKey: nextPitchRowKey,
          slotKey: nextSlotKey,
          fieldLabel: nextFieldLabel,
          startAt: createIsoDateTime(nextDayKey, nextSlotKey, false),
          endAt: createIsoDateTime(nextDayKey, nextSlotKey, true),
          location: resolvedLocation,
        };
      });
      // Persist the updated event's allocation immediately; reverts on rejection.
      const updated = next.find((e) => e.id === eventId);
      if (updated && previous) void persistAllocation(updated, previous);
      return next;
    });
  }

  function updateRoom(eventId: string, roomType: "home" | "away", roomCode: string | null) {
    setEvents((current) => {
      const previous = current.find((e) => e.id === eventId) ?? null;

      const next = current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              allocation: {
                ...event.allocation,
                homeDressingRoomCode:
                  roomType === "home" ? roomCode : event.allocation.homeDressingRoomCode,
                awayDressingRoomCode:
                  roomType === "away" ? roomCode : event.allocation.awayDressingRoomCode,
              },
            }
          : event,
      );
      // Persist room change immediately; reverts on rejection.
      const updated = next.find((e) => e.id === eventId);
      if (updated && previous) void persistAllocation(updated, previous);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {saveError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      ) : null}
      <WochenplanPublishBar
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        onPublish={publishWeek}
        weekId={weekId}
        activeVariantLabel={publishedVariant}
      />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          {DAYS.map((day) => (
            <WochenplanDayGrid
              key={day.key}
              dayLabel={formatBoardDayLabel(day.key, day.label, weekStart)}
              dayKey={day.key}
              pitchRows={PITCH_ROWS}
              timeSlots={TIME_SLOTS}
              events={events}
              roomConflictCount={
                roomConflicts.filter((conflict) => {
                  const matchingEvent = events.find((event) => event.id === conflict.eventId);
                  return matchingEvent?.boardDayKey === day.key;
                }).length
              }
              onOpenDayPlanner={openDayPlanner}
              onDropEvent={handleDropEvent}
              onOpenRooms={setRoomDrawerEventId}
              onDragStart={setDraggingEventId}
              onDragEnd={() => setDraggingEventId(null)}
              draggingEventId={draggingEventId}
            />
          ))}

          <WochenplanLegend />
        </div>

        <div className="space-y-6">
          <WochenplanConflictPanel conflicts={conflicts} />
        </div>
      </div>

      <WochenplanRoomDayPlannerDialog
        isOpen={!!dayPlannerState.dayKey}
        dayKey={dayPlannerState.dayKey}
        dayLabel={dayPlannerState.dayLabel}
        events={events}
        roomConflicts={roomConflicts}
        onClose={() => setDayPlannerState({ dayKey: null, dayLabel: null })}
        onChangeRoom={updateRoom}
        roomOptions={dayPlannerRoomOptions}
      />

      <WochenplanRoomDrawer
        event={roomDrawerEvent}
        occupiedRooms={occupiedRooms}
        roomOptions={drawerRoomOptions}
        onClose={() => setRoomDrawerEventId(null)}
        onChangeHomeRoom={(roomCode) => {
          if (!roomDrawerEvent) {
            return;
          }

          updateRoom(roomDrawerEvent.id, "home", roomCode);
        }}
        onChangeAwayRoom={(roomCode) => {
          if (!roomDrawerEvent) {
            return;
          }

          updateRoom(roomDrawerEvent.id, "away", roomCode);
        }}
      />
    </div>
  );
}
