/**
 * lib/attendance/errors.ts
 *
 * Typed errors for the attendance domain.
 */

export class AttendanceNotFoundError extends Error {
  constructor(recordId: string) {
    super(`AttendanceRecord "${recordId}" was not found.`);
    this.name = "AttendanceNotFoundError";
  }
}

export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceValidationError";
  }
}

export class AttendanceTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceTenantMismatchError";
  }
}

export class AttendanceEventNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceEventNotFoundError";
  }
}
