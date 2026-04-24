"use client";

import { useMemo, useState } from "react";
import WochenplanConflictPanel from "@/components/admin/wochenplan/WochenplanConflictPanel";
import WochenplanDayGrid from "@/components/admin/wochenplan/WochenplanDayGrid";
import WochenplanLegend from "@/components/admin/wochenplan/WochenplanLegend";
import WochenplanLiveOverview from "@/components/admin/wochenplan/WochenplanLiveOverview";
import WochenplanPublishBar from "@/components/admin/wochenplan/WochenplanPublishBar";
import WochenplanRoomDayPlannerDialog, {
  type WochenplanRoomConflictPair,
} from "@/components/admin/wochenplan/WochenplanRoomDayPlannerDialog";
import WochenplanRoomDrawer from "@/components/admin/wochenplan/WochenplanRoomDrawer";
import { getWochenplanConflicts } from "@/lib/wochenplan/conflict-engine";
import type {
  WochenplanBoardDayKey,
  WochenplanBoardEvent,
  WochenplanBoardPitchRowKey,
  WochenplanBoardSlotKey,
  WochenplanEventItem,
} from "@/lib/wochenplan/types";

const PITCH_ROWS: Array<{ key: WochenplanBoardPitchRowKey; fieldLabel: "A" | "B"; label: string }> = [
  { key: "STADION", fieldLabel: "A", label: "Stadion · Feld A" },
  { key: "STADION", fieldLabel: "B", label: "Stadion · Feld B" },
  { key: "KUNSTRASEN_2", fieldLabel: "A", label: "KR 2 · Feld A" },
  { key: "KUNSTRASEN_2", fieldLabel: "B", label: "KR 2 · Feld B" },
  { key: "KUNSTRASEN_3", fieldLabel: "A", label: "KR 3 · Feld A" },
  { key: "KUNSTRASEN_3", fieldLabel: "B", label: "KR 3 · Feld B" },
];

const WEEKDAY_TIME_SLOTS: WochenplanBoardSlotKey[] = [
  "15:45-17:15",
  "17:15-18:45",
  "18:45-20:15",
  "20:15-21:45",
];

const WEEKEND_TIME_SLOTS: WochenplanBoardSlotKey[] = [
  "08:00-10:00",
  "10:00-12:00",
  "12:00-14:00",
  "14:00-17:15",
  "17:15-18:45",
  "18:45-20:15",
  "20:15-21:45",
];

type WochenplanViewMode = "LIVE" | "PLANNING" | "BOOKING";

const DAYS: Array<{ key: WochenplanBoardDayKey; label: string }> = [
  { key: "MONDAY", label: "Montag" },
  { key: "TUESDAY", label: "Dienstag" },
  { key: "WEDNESDAY", label: "Mittwoch" },
  { key: "THURSDAY", label: "Donnerstag" },
  { key: "FRIDAY", label: "Freitag" },
  { key: "SATURDAY", label: "Samstag" },
  { key: "SUNDAY", label: "Sonntag" },
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

function getDayOffset(dayKey: WochenplanBoardDayKey) {
  if (dayKey === "MONDAY") return 0;
  if (dayKey === "TUESDAY") return 1;
  if (dayKey === "WEDNESDAY") return 2;
  if (dayKey === "THURSDAY") return 3;
  if (dayKey === "FRIDAY") return 4;
  if (dayKey === "SATURDAY") return 5;
  return 6;
}

function formatIsoDate(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function getBoardDate(dayKey: WochenplanBoardDayKey, weekStartDate: string) {
  const date = new Date(weekStartDate + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + getDayOffset(dayKey));
  return formatIsoDate(date);
}

function formatBoardDayLabel(dayKey: WochenplanBoardDayKey, dayLabel: string, weekStartDate: string) {
  const date = new Date(getBoardDate(dayKey, weekStartDate) + "T12:00:00");
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
  weekStartDate = "2026-04-13",
) {
  const date = getBoardDate(dayKey, weekStartDate);
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

export default function WochenplanBoard({
  initialEvents = [],
  visibleDayKeys,
  currentDayKey,
  weekStartDate = "2026-04-13",
}: {
  initialEvents?: WochenplanBoardEvent[];
  visibleDayKeys?: WochenplanBoardDayKey[];
  currentDayKey?: WochenplanBoardDayKey | null;
  weekStartDate?: string;
}) {
  const [events, setEvents] = useState<WochenplanBoardEvent[]>(initialEvents.length > 0 ? initialEvents : buildDemoEvents());
  const [viewMode, setViewMode] = useState<WochenplanViewMode>("LIVE");
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [roomDrawerEventId, setRoomDrawerEventId] = useState<string | null>(null);
  const [dayPlannerState, setDayPlannerState] = useState<{
    dayKey: WochenplanBoardDayKey | null;
    dayLabel: string | null;
  }>({
    dayKey: null,
    dayLabel: null,
  });

  const [publishedSnapshot, setPublishedSnapshot] = useState(() =>
    buildSnapshot(initialEvents.length > 0 ? initialEvents : buildDemoEvents()),
  );
  const currentSnapshot = useMemo(() => buildSnapshot(events), [events]);
  const hasUnsavedChanges = currentSnapshot !== publishedSnapshot;

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
    nextFieldLabel: "A" | "B",
  ) {
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) {
          return event;
        }

        const assignedFieldLabel = event.eventType === "TRAINING" ? nextFieldLabel : null;

        return {
          ...event,
          boardDayKey: nextDayKey,
          pitchRowKey: nextPitchRowKey,
          slotKey: nextSlotKey,
          fieldLabel: assignedFieldLabel,
          startAt: createIsoDateTime(nextDayKey, nextSlotKey, false, weekStartDate),
          endAt: createIsoDateTime(nextDayKey, nextSlotKey, true, weekStartDate),
          location:
            nextPitchRowKey === "STADION"
              ? "Stadion"
              : nextPitchRowKey === "KUNSTRASEN_2"
                ? "Kunstrasen 2"
                : "Kunstrasen 3",
        };
      }),
    );
  }

  function updateRoom(eventId: string, roomType: "home" | "away", roomCode: string | null) {
    setEvents((current) =>
      current.map((event) =>
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
      ),
    );
  }

  const visibleDays = visibleDayKeys && visibleDayKeys.length > 0 ? DAYS.filter((day) => visibleDayKeys.includes(day.key)) : DAYS;

  return (
    <div className="space-y-6">
      <WochenplanPublishBar
        hasUnsavedChanges={hasUnsavedChanges}
        events={events}
        onPublished={() => setPublishedSnapshot(buildSnapshot(events))}
      />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="space-y-6">
          {visibleDays.map((day) => (
            <WochenplanDayGrid
              key={day.key}
              dayLabel={formatBoardDayLabel(day.key, day.label, weekStartDate)}
              dayKey={day.key}
              pitchRows={PITCH_ROWS}
              timeSlots={day.key === "SATURDAY" || day.key === "SUNDAY" ? WEEKEND_TIME_SLOTS : WEEKDAY_TIME_SLOTS}
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
              isToday={currentDayKey === day.key}
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
      />

      <WochenplanRoomDrawer
        event={roomDrawerEvent}
        occupiedRooms={occupiedRooms}
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












