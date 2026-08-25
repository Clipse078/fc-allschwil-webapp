/**
 * lib/participation/event-reference.ts
 *
 * Re-exports attendance event-reference helpers — participation uses the same
 * discriminated event reference strategy and tenant validation chain.
 */

export {
  assertValidEventRefShape,
  resolveAttendanceEventContext as resolveParticipationEventContext,
  toAttendanceEventRef as toParticipationEventRef,
} from "@/lib/attendance/event-reference";
