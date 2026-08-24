/**
 * lib/attendance/labels.ts
 *
 * German user-facing labels for attendance statuses and event kinds.
 */

import type { AttendanceEventKind, AttendanceStatus } from "@prisma/client";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  OPEN: "Offen",
  PRESENT: "Anwesend",
  ABSENT: "Abwesend",
  EXCUSED: "Entschuldigt",
  INJURED: "Verletzt",
};

export const ATTENDANCE_EVENT_KIND_LABELS: Record<AttendanceEventKind, string> = {
  TRAINING: "Training",
  MATCH: "Spiel",
  TOURNAMENT: "Turnier",
};

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_LABELS[status];
}

export function getAttendanceEventKindLabel(eventKind: AttendanceEventKind): string {
  return ATTENDANCE_EVENT_KIND_LABELS[eventKind];
}
