/**
 * lib/meetings/meeting-delete-service.ts
 *
 * ADMIN-HARD-DELETE-UI — Meeting permanent hard-delete service.
 *
 * Design principles:
 *   • Impact preview never mutates — counts cascade children only.
 *   • All sub-entities (agendaItems, decisions, actions, participants)
 *     cascade automatically on Meeting delete (onDelete: Cascade in schema).
 *   • Canonical tenant ownership is checked before impact reads and deletion.
 *   • A single prisma.meeting.delete() is sufficient; no pre-cleanup needed.
 */

import { prisma } from "@/lib/db/prisma";

export type MeetingDeletionImpact = {
  /** Agenda items — cascade-deleted */
  agendaItems: number;
  /** Decisions recorded in this meeting — cascade-deleted */
  decisions: number;
  /** Action items (Aufgaben) — cascade-deleted */
  actions: number;
  /** Participants — cascade-deleted */
  participants: number;
};

export type MeetingDeletionResult = {
  meetingId: string;
  title: string;
  impact: MeetingDeletionImpact;
};

/**
 * Returns the deletion impact for a Meeting.
 * Returns null when the meeting does not exist.
 * Never mutates.
 */
export async function getMeetingDeletionImpact(
  meetingId: string,
  tenantId: string,
): Promise<MeetingDeletionImpact | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: {
      _count: {
        select: {
          agendaItems: true,
          decisions: true,
          actions: true,
          participants: true,
        },
      },
    },
  });

  if (!meeting) return null;

  return {
    agendaItems: meeting._count.agendaItems,
    decisions: meeting._count.decisions,
    actions: meeting._count.actions,
    participants: meeting._count.participants,
  };
}

/**
 * Permanently deletes a Meeting and all cascade-linked sub-entities.
 *
 * Cascade order (all automatic via onDelete: Cascade in schema):
 *   MeetingAgendaItem, MeetingDecision, MeetingAction, MeetingParticipant
 *
 * Returns null when the meeting does not exist (idempotent-safe).
 */
export async function deleteMeetingPermanently(
  meetingId: string,
  tenantId: string,
): Promise<MeetingDeletionResult | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: {
      title: true,
      _count: {
        select: {
          agendaItems: true,
          decisions: true,
          actions: true,
          participants: true,
        },
      },
    },
  });

  if (!meeting) return null;

  const impact: MeetingDeletionImpact = {
    agendaItems: meeting._count.agendaItems,
    decisions: meeting._count.decisions,
    actions: meeting._count.actions,
    participants: meeting._count.participants,
  };

  await prisma.meeting.delete({ where: { id: meetingId, tenantId } });

  return { meetingId, title: meeting.title, impact };
}
