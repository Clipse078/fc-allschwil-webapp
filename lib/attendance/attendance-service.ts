/**
 * lib/attendance/attendance-service.ts
 *
 * TEAM-COCKPIT-02B — canonical attendance write path.
 */

import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { resolveAttendanceEventContext } from "./event-reference";
import {
  AttendanceNotFoundError,
  AttendanceTenantMismatchError,
  AttendanceValidationError,
} from "./errors";
import { ATTENDANCE_STATUSES } from "./types";
import type { AttendanceEventRef, AttendanceRecordInput } from "./types";

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

async function assertPersonOnRoster(
  tenantId: string,
  teamSeasonId: string,
  personId: string,
): Promise<void> {
  const [person, squadMember] = await Promise.all([
    prisma.person.findFirst({
      where: { id: personId, tenantId },
      select: { id: true, isPlayer: true },
    }),
    prisma.playerSquadMember.findFirst({
      where: { teamSeasonId, personId },
      select: { id: true },
    }),
  ]);

  if (!person) {
    throw new AttendanceTenantMismatchError("Person gehört nicht zu diesem Mandanten.");
  }

  if (!person.isPlayer || !squadMember) {
    throw new AttendanceValidationError("Person ist kein Spieler im aktuellen Kader.");
  }
}

export async function upsertAttendanceRecord(
  tenantId: string,
  actorUserId: string | null,
  input: AttendanceRecordInput,
): Promise<{ id: string; status: AttendanceStatus }> {
  if (!isAttendanceStatus(input.status)) {
    throw new AttendanceValidationError("Ungültiger Anwesenheitsstatus.");
  }

  const eventContext = await resolveAttendanceEventContext(
    tenantId,
    input.teamSeasonId,
    input.event,
  );

  if (eventContext.teamSeasonId !== input.teamSeasonId) {
    throw new AttendanceValidationError("Team-Saison stimmt nicht mit dem Event überein.");
  }

  await assertPersonOnRoster(tenantId, input.teamSeasonId, input.personId);

  const note =
    input.note === null || input.note === undefined ? null : String(input.note).trim() || null;

  const lookupWhere: Prisma.AttendanceRecordWhereInput =
    eventContext.eventKind === "TRAINING"
      ? {
          tenantId,
          personId: input.personId,
          trainingSessionId: eventContext.trainingSessionId,
        }
      : {
          tenantId,
          personId: input.personId,
          eventId: eventContext.eventId,
        };

  const existing = await prisma.attendanceRecord.findFirst({
    where: lookupWhere,
    select: {
      id: true,
      status: true,
      note: true,
    },
  });

  if (existing) {
    const updated = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        note,
        updatedByUserId: actorUserId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    void logAction({
      tenantId,
      actorUserId,
      moduleKey: "attendance",
      entityType: "AttendanceRecord",
      entityId: updated.id,
      action: "ATTENDANCE_UPDATE",
      beforeJson: {
        status: existing.status,
        note: existing.note,
      },
      afterJson: {
        status: updated.status,
        note,
      },
    });

    return updated;
  }

  const created = await prisma.attendanceRecord.create({
    data: {
      tenantId,
      personId: input.personId,
      teamSeasonId: input.teamSeasonId,
      eventKind: eventContext.eventKind,
      trainingSessionId: eventContext.trainingSessionId,
      eventId: eventContext.eventId,
      status: input.status,
      note,
      recordedByUserId: actorUserId,
      updatedByUserId: actorUserId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  void logAction({
    tenantId,
    actorUserId,
    moduleKey: "attendance",
    entityType: "AttendanceRecord",
    entityId: created.id,
    action: "ATTENDANCE_RECORD",
    afterJson: {
      status: created.status,
      note,
      personId: input.personId,
      eventKind: eventContext.eventKind,
      trainingSessionId: eventContext.trainingSessionId,
      eventId: eventContext.eventId,
    },
  });

  return created;
}

export async function bulkUpsertEventAttendance(
  tenantId: string,
  actorUserId: string | null,
  teamSeasonId: string,
  event: AttendanceEventRef,
  entries: Array<{ personId: string; status: AttendanceStatus; note?: string | null }>,
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;

  for (const entry of entries) {
    await upsertAttendanceRecord(tenantId, actorUserId, {
      personId: entry.personId,
      teamSeasonId,
      event,
      status: entry.status,
      note: entry.note ?? null,
    });
    updatedCount += 1;
  }

  return { updatedCount };
}

export async function getAttendanceRecordById(tenantId: string, recordId: string) {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, tenantId },
  });

  if (!record) {
    throw new AttendanceNotFoundError(recordId);
  }

  return record;
}
