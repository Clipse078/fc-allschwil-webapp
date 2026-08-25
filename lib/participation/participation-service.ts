/**
 * lib/participation/participation-service.ts
 *
 * TEAM-COCKPIT-03A — canonical participation response write path.
 */

import type { ParticipationResponseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { resolveParticipationEventContext } from "./event-reference";
import {
  ParticipationTenantMismatchError,
  ParticipationValidationError,
} from "./errors";
import { PARTICIPATION_STATUSES } from "./types";
import type { ParticipationEventRef, ParticipationResponseInput } from "./types";

function isParticipationStatus(value: string): value is ParticipationResponseStatus {
  return (PARTICIPATION_STATUSES as readonly string[]).includes(value);
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
    throw new ParticipationTenantMismatchError("Person gehört nicht zu diesem Mandanten.");
  }

  if (!person.isPlayer || !squadMember) {
    throw new ParticipationValidationError("Person ist kein Spieler im aktuellen Kader.");
  }
}

export async function respondToParticipation(
  tenantId: string,
  actorUserId: string | null,
  input: ParticipationResponseInput,
): Promise<{ id: string; status: ParticipationResponseStatus }> {
  if (!isParticipationStatus(input.status)) {
    throw new ParticipationValidationError("Ungültiger Teilnahme-Status.");
  }

  const eventContext = await resolveParticipationEventContext(
    tenantId,
    input.teamSeasonId,
    input.event,
  );

  if (eventContext.teamSeasonId !== input.teamSeasonId) {
    throw new ParticipationValidationError("Team-Saison stimmt nicht mit dem Event überein.");
  }

  await assertPersonOnRoster(tenantId, input.teamSeasonId, input.personId);

  const note =
    input.note === null || input.note === undefined ? null : String(input.note).trim() || null;

  const respondedAt = input.status === "OPEN" ? null : new Date();

  const lookupWhere: Prisma.ParticipationResponseWhereInput =
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

  const existing = await prisma.participationResponse.findFirst({
    where: lookupWhere,
    select: {
      id: true,
      status: true,
      note: true,
    },
  });

  if (existing) {
    const updated = await prisma.participationResponse.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        note,
        respondedAt,
        responseSource: input.responseSource,
        respondedByUserId: actorUserId,
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
      moduleKey: "participation",
      entityType: "ParticipationResponse",
      entityId: updated.id,
      action: "PARTICIPATION_UPDATE",
      beforeJson: {
        status: existing.status,
        note: existing.note,
      },
      afterJson: {
        status: updated.status,
        note,
        responseSource: input.responseSource,
      },
    });

    return updated;
  }

  const created = await prisma.participationResponse.create({
    data: {
      tenantId,
      personId: input.personId,
      teamSeasonId: input.teamSeasonId,
      eventKind: eventContext.eventKind,
      trainingSessionId: eventContext.trainingSessionId,
      eventId: eventContext.eventId,
      status: input.status,
      note,
      respondedAt,
      responseSource: input.responseSource,
      respondedByUserId: actorUserId,
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
    moduleKey: "participation",
    entityType: "ParticipationResponse",
    entityId: created.id,
    action: "PARTICIPATION_RESPONSE",
    afterJson: {
      status: created.status,
      note,
      personId: input.personId,
      eventKind: eventContext.eventKind,
      trainingSessionId: eventContext.trainingSessionId,
      eventId: eventContext.eventId,
      responseSource: input.responseSource,
    },
  });

  return created;
}

export async function updateParticipationResponse(
  tenantId: string,
  actorUserId: string | null,
  input: ParticipationResponseInput,
): Promise<{ id: string; status: ParticipationResponseStatus }> {
  return respondToParticipation(tenantId, actorUserId, input);
}

export async function getParticipationResponseById(tenantId: string, responseId: string) {
  const response = await prisma.participationResponse.findFirst({
    where: { id: responseId, tenantId },
  });

  if (!response) {
    throw new ParticipationValidationError(`Teilnahme-Rückmeldung nicht gefunden: ${responseId}`);
  }

  return response;
}
