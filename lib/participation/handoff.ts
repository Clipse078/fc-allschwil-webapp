/**
 * lib/participation/handoff.ts
 *
 * TEAM-COCKPIT-03A — participation → attendance handoff helpers.
 *
 * Participation responses are pre-event intent. Attendance records are
 * canonical actual attendance. These helpers suggest mappings but never
 * write attendance automatically.
 */

import type { AttendanceStatus, ParticipationResponseStatus } from "@prisma/client";

/**
 * Suggests an AttendanceStatus from a participation response.
 * Returns null when no reliable suggestion exists (OPEN, MAYBE).
 *
 * IMPORTANT: A participation YES does NOT permanently equal PRESENT.
 * Trainer confirmation/correction remains required before writing attendance.
 */
export function suggestAttendanceStatusFromParticipation(
  participationStatus: ParticipationResponseStatus,
): AttendanceStatus | null {
  switch (participationStatus) {
    case "YES":
      return "PRESENT";
    case "NO":
      return "ABSENT";
    case "MAYBE":
    case "OPEN":
      return null;
    default: {
      const _exhaustive: never = participationStatus;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Returns true when a participation response could inform attendance prefill.
 * Does not imply the attendance record should be auto-created.
 */
export function canPrefillAttendanceFromParticipation(
  participationStatus: ParticipationResponseStatus,
): boolean {
  return suggestAttendanceStatusFromParticipation(participationStatus) !== null;
}
