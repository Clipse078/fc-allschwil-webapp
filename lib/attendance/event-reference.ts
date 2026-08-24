/**
 * lib/attendance/event-reference.ts
 *
 * Validates and normalises discriminated event references for attendance.
 */

import type { AttendanceEventKind, EventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AttendanceEventRef } from "./types";
import {
  AttendanceEventNotFoundError,
  AttendanceTenantMismatchError,
  AttendanceValidationError,
} from "./errors";

const EVENT_KIND_TO_EVENT_TYPE: Record<"MATCH" | "TOURNAMENT", EventType> = {
  MATCH: "MATCH",
  TOURNAMENT: "TOURNAMENT",
};

export function assertValidEventRefShape(event: AttendanceEventRef): void {
  if (event.eventKind === "TRAINING") {
    if (!event.trainingSessionId?.trim()) {
      throw new AttendanceValidationError("TrainingSession-ID fehlt.");
    }
    return;
  }

  if (!event.eventId?.trim()) {
    throw new AttendanceValidationError("Event-ID fehlt.");
  }
}

export async function resolveAttendanceEventContext(
  tenantId: string,
  teamSeasonId: string,
  event: AttendanceEventRef,
): Promise<{
  teamSeasonId: string;
  eventKind: AttendanceEventKind;
  trainingSessionId: string | null;
  eventId: string | null;
  title: string;
  date: Date;
}> {
  assertValidEventRefShape(event);

  const teamSeason = await prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      team: { tenantId },
    },
    select: {
      id: true,
      teamId: true,
    },
  });

  if (!teamSeason) {
    throw new AttendanceTenantMismatchError("Team-Saison gehört nicht zu diesem Mandanten.");
  }

  if (event.eventKind === "TRAINING") {
    const session = await prisma.trainingSession.findFirst({
      where: {
        id: event.trainingSessionId,
        tenantId,
        teamSeasonId,
      },
      select: {
        id: true,
        date: true,
        startAt: true,
        trainingSeries: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!session) {
      throw new AttendanceEventNotFoundError("Trainingseinheit nicht gefunden.");
    }

    return {
      teamSeasonId,
      eventKind: "TRAINING",
      trainingSessionId: session.id,
      eventId: null,
      title: session.trainingSeries.title,
      date: session.startAt,
    };
  }

  const expectedType = EVENT_KIND_TO_EVENT_TYPE[event.eventKind];
  const calendarEvent = await prisma.event.findFirst({
    where: {
      id: event.eventId,
      tenantId,
      type: expectedType,
      teamId: teamSeason.teamId,
    },
    select: {
      id: true,
      title: true,
      startAt: true,
    },
  });

  if (!calendarEvent) {
    throw new AttendanceEventNotFoundError("Event nicht gefunden.");
  }

  return {
    teamSeasonId,
    eventKind: event.eventKind,
    trainingSessionId: null,
    eventId: calendarEvent.id,
    title: calendarEvent.title,
    date: calendarEvent.startAt,
  };
}

export function toAttendanceEventRef(input: {
  eventKind: AttendanceEventKind;
  trainingSessionId?: string | null;
  eventId?: string | null;
}): AttendanceEventRef {
  if (input.eventKind === "TRAINING") {
    return {
      eventKind: "TRAINING",
      trainingSessionId: String(input.trainingSessionId ?? ""),
    };
  }

  return {
    eventKind: input.eventKind,
    eventId: String(input.eventId ?? ""),
  };
}
