import { prisma } from "@/lib/db/prisma";

type ConflictInput = {
  tenantId: string;
  eventId?: string | null;
  startAt: Date;
  endAt: Date | null;
  pitchCode?: string | null;
  homeDressingRoomCode?: string | null;
  awayDressingRoomCode?: string | null;
};

function effectiveEnd(startAt: Date, endAt: Date | null) {
  if (endAt) return endAt;

  const fallback = new Date(startAt);
  fallback.setMinutes(fallback.getMinutes() + 90);
  return fallback;
}

function overlapsWhere(startAt: Date, endAt: Date | null) {
  const effective = effectiveEnd(startAt, endAt);

  return {
    startAt: { lt: effective },
    OR: [
      { endAt: null },
      { endAt: { gt: startAt } },
    ],
  };
}

export async function findWeeklyPlanAllocationConflicts(input: ConflictInput) {
  const endAt = effectiveEnd(input.startAt, input.endAt);

  if (endAt <= input.startAt) {
    throw new Error("Invalid event time range.");
  }

  const conflicts = [];

  if (
    input.homeDressingRoomCode &&
    input.awayDressingRoomCode &&
    input.homeDressingRoomCode === input.awayDressingRoomCode
  ) {
    conflicts.push({
      type: "same-event-dressing-room",
      message: "Home and away dressing room cannot be identical.",
    });
  }

  const baseWhere = {
    tenantId: input.tenantId,
    id: input.eventId ? { not: input.eventId } : undefined,
    ...overlapsWhere(input.startAt, input.endAt),
  };

  if (input.pitchCode) {
    const pitchConflict = await prisma.event.findFirst({
      where: {
        ...baseWhere,
        pitchCode: input.pitchCode,
      },
      select: { id: true, title: true, startAt: true, endAt: true },
    });

    if (pitchConflict) {
      conflicts.push({
        type: "pitch",
        message: "Pitch is already allocated during this time.",
        event: pitchConflict,
      });
    }
  }

  const roomCodes = [
    input.homeDressingRoomCode,
    input.awayDressingRoomCode,
  ].filter(Boolean) as string[];

  for (const code of roomCodes) {
    const roomConflict = await prisma.event.findFirst({
      where: {
        ...baseWhere,
        OR: [
          { homeDressingRoomCode: code },
          { awayDressingRoomCode: code },
        ],
      },
      select: { id: true, title: true, startAt: true, endAt: true },
    });

    if (roomConflict) {
      conflicts.push({
        type: "dressing-room",
        code,
        message: "Dressing room is already allocated during this time.",
        event: roomConflict,
      });
    }
  }

  return conflicts;
}

export async function assertNoWeeklyPlanAllocationConflicts(input: ConflictInput) {
  const conflicts = await findWeeklyPlanAllocationConflicts(input);

  if (conflicts.length > 0) {
    throw new Error(conflicts.map((conflict) => conflict.message).join(" "));
  }

  return true;
}
