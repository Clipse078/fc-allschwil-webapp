/**
 * lib/attendance/types.ts
 *
 * TEAM-COCKPIT-02B — canonical attendance domain types.
 *
 * Event reference strategy mirrors WeekplannerItem:
 *   TRAINING   → trainingSessionId
 *   MATCH      → eventId (Event.type = MATCH)
 *   TOURNAMENT → eventId (Event.type = TOURNAMENT)
 */

import type { AttendanceEventKind, AttendanceStatus } from "@prisma/client";

export type { AttendanceEventKind, AttendanceStatus };

export const ATTENDANCE_STATUSES = [
  "OPEN",
  "PRESENT",
  "ABSENT",
  "EXCUSED",
  "INJURED",
] as const satisfies readonly AttendanceStatus[];

export const ATTENDANCE_EVENT_KINDS = [
  "TRAINING",
  "MATCH",
  "TOURNAMENT",
] as const satisfies readonly AttendanceEventKind[];

/** Statuses that count toward the attendance percentage denominator. */
export const ATTENDANCE_DENOMINATOR_STATUSES = [
  "PRESENT",
  "ABSENT",
  "EXCUSED",
  "INJURED",
] as const satisfies readonly AttendanceStatus[];

export type AttendanceEventRef =
  | { eventKind: "TRAINING"; trainingSessionId: string }
  | { eventKind: "MATCH"; eventId: string }
  | { eventKind: "TOURNAMENT"; eventId: string };

export type AttendanceRecordInput = {
  personId: string;
  teamSeasonId: string;
  event: AttendanceEventRef;
  status: AttendanceStatus;
  note?: string | null;
};

export type AttendanceStatusCounts = {
  open: number;
  present: number;
  absent: number;
  excused: number;
  injured: number;
};

export type PlayerAttendanceSummary = {
  personId: string;
  displayName: string;
  shirtNumber: number | null;
  eventCount: number;
  counts: AttendanceStatusCounts;
  percentage: number | null;
  percentageLabel: string;
};

export type TeamAttendanceOverview = {
  teamSeasonId: string;
  players: PlayerAttendanceSummary[];
};

export type PlayerAttendanceHistoryEntry = {
  id: string;
  date: string;
  eventKind: AttendanceEventKind;
  eventKindLabel: string;
  eventTitle: string;
  status: AttendanceStatus;
  statusLabel: string;
  note: string | null;
};

export type EventAttendanceEntry = {
  personId: string;
  displayName: string;
  shirtNumber: number | null;
  recordId: string | null;
  status: AttendanceStatus;
  note: string | null;
};

export type EventAttendanceSheetData = {
  event: AttendanceEventRef & {
    title: string;
    date: string;
    eventKindLabel: string;
  };
  entries: EventAttendanceEntry[];
};
