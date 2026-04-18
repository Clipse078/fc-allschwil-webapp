import {
  getPitchAllocationByCode,
  type PitchAllocationCode,
} from "@/lib/facilities/pitches";

export function requiresFullPitch(eventType: string) {
  return eventType === "MATCH" || eventType === "TOURNAMENT";
}

export function canUseHalfPitch(eventType: string) {
  return eventType === "TRAINING";
}

export function validatePitchAllocationForEventType(args: {
  eventType: string;
  pitchCode: PitchAllocationCode | null | undefined;
}) {
  const allocation = getPitchAllocationByCode(args.pitchCode);

  if (!allocation) {
    return {
      ok: true,
      reason: null as string | null,
    };
  }

  if (requiresFullPitch(args.eventType) && allocation.mode !== "FULL") {
    return {
      ok: false,
      reason: "Für Matches und Turniere sind nur ganze Plätze erlaubt.",
    };
  }

  if (!canUseHalfPitch(args.eventType) && allocation.mode !== "FULL") {
    return {
      ok: false,
      reason: "Halbe Plätze sind nur für Trainings erlaubt.",
    };
  }

  return {
    ok: true,
    reason: null as string | null,
  };
}

export function pitchAllocationsConflict(
  firstPitchCode: string | null | undefined,
  secondPitchCode: string | null | undefined,
) {
  const first = getPitchAllocationByCode(firstPitchCode);
  const second = getPitchAllocationByCode(secondPitchCode);

  if (!first || !second) {
    return false;
  }

  if (first.basePitchCode !== second.basePitchCode) {
    return false;
  }

  if (first.mode === "FULL" || second.mode === "FULL") {
    return true;
  }

  return first.code === second.code;
}

export function dressingRoomConflict(
  firstRoomCode: string | null | undefined,
  secondRoomCode: string | null | undefined,
) {
  if (!firstRoomCode || !secondRoomCode) {
    return false;
  }

  return firstRoomCode === secondRoomCode;
}

export function timeRangesOverlap(args: {
  startA: Date | string;
  endA: Date | string | null | undefined;
  startB: Date | string;
  endB: Date | string | null | undefined;
}) {
  const startA = new Date(args.startA).getTime();
  const startB = new Date(args.startB).getTime();

  const endA = args.endA ? new Date(args.endA).getTime() : startA;
  const endB = args.endB ? new Date(args.endB).getTime() : startB;

  if (
    Number.isNaN(startA) ||
    Number.isNaN(startB) ||
    Number.isNaN(endA) ||
    Number.isNaN(endB)
  ) {
    return false;
  }

  return startA < endB && startB < endA;
}