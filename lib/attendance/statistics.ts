/**
 * lib/attendance/statistics.ts
 *
 * Canonical attendance percentage calculation.
 *
 * Formula:
 *   denominator = PRESENT + ABSENT + EXCUSED + INJURED
 *   percentage  = PRESENT / denominator
 *
 * OPEN is excluded from the denominator and numerator.
 * Zero denominator → null (display "—", not 0%).
 */

import type { AttendanceStatus } from "@prisma/client";
import { ATTENDANCE_DENOMINATOR_STATUSES } from "./types";

export type AttendanceCountInput = {
  open: number;
  present: number;
  absent: number;
  excused: number;
  injured: number;
};

export function countStatuses(statuses: AttendanceStatus[]): AttendanceCountInput {
  const counts: AttendanceCountInput = {
    open: 0,
    present: 0,
    absent: 0,
    excused: 0,
    injured: 0,
  };

  for (const status of statuses) {
    switch (status) {
      case "OPEN":
        counts.open += 1;
        break;
      case "PRESENT":
        counts.present += 1;
        break;
      case "ABSENT":
        counts.absent += 1;
        break;
      case "EXCUSED":
        counts.excused += 1;
        break;
      case "INJURED":
        counts.injured += 1;
        break;
      default: {
        const _exhaustive: never = status;
        void _exhaustive;
      }
    }
  }

  return counts;
}

export function calculateAttendancePercentage(counts: AttendanceCountInput): number | null {
  const denominator =
    counts.present + counts.absent + counts.excused + counts.injured;

  if (denominator === 0) {
    return null;
  }

  return counts.present / denominator;
}

export function formatAttendancePercentage(percentage: number | null): string {
  if (percentage === null) {
    return "—";
  }

  return `${Math.round(percentage * 100)}%`;
}

export function isDenominatorStatus(status: AttendanceStatus): boolean {
  return (ATTENDANCE_DENOMINATOR_STATUSES as readonly AttendanceStatus[]).includes(status);
}
