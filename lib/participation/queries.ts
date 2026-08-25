/**
 * lib/participation/queries.ts
 *
 * TEAM-COCKPIT-03A — read models for participation views.
 */

import type { AttendanceEventKind } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getParticipationEventKindLabel,
  getParticipationResponseSourceLabel,
  getParticipationStatusLabel,
} from "./labels";
import { resolveParticipationEventContext } from "./event-reference";
import { buildParticipationSummary } from "./statistics";
import type {
  EventParticipationData,
  MyParticipationRequest,
  ParticipationEventRef,
  TeamUpcomingParticipation,
  UpcomingParticipationEvent,
} from "./types";

function formatPersonName(input: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}): string {
  return input.displayName?.trim() || `${input.firstName} ${input.lastName}`.trim();
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatIsoDateTime(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export async function getParticipationForEvent(
  tenantId: string,
  teamSeasonId: string,
  event: ParticipationEventRef,
): Promise<EventParticipationData> {
  const eventContext = await resolveParticipationEventContext(tenantId, teamSeasonId, event);

  const [squadMembers, responses] = await Promise.all([
    prisma.playerSquadMember.findMany({
      where: {
        teamSeasonId,
        teamSeason: {
          team: { tenantId },
        },
      },
      select: {
        personId: true,
        shirtNumber: true,
        sortOrder: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { shirtNumber: "asc" }],
    }),
    prisma.participationResponse.findMany({
      where: {
        tenantId,
        teamSeasonId,
        eventKind: eventContext.eventKind,
        ...(eventContext.eventKind === "TRAINING"
          ? { trainingSessionId: eventContext.trainingSessionId }
          : { eventId: eventContext.eventId }),
      },
      select: {
        id: true,
        personId: true,
        status: true,
        note: true,
        respondedAt: true,
        responseSource: true,
      },
    }),
  ]);

  const responseByPerson = new Map(responses.map((response) => [response.personId, response]));
  const playerStatuses = squadMembers.map(
    (member) => responseByPerson.get(member.personId)?.status ?? "OPEN",
  );

  return {
    event: {
      ...event,
      title: eventContext.title,
      date: formatDateKey(eventContext.date),
      eventKindLabel: getParticipationEventKindLabel(eventContext.eventKind),
    },
    summary: buildParticipationSummary(squadMembers.length, playerStatuses),
    players: squadMembers.map((member) => {
      const response = responseByPerson.get(member.personId);
      const status = response?.status ?? "OPEN";
      return {
        personId: member.personId,
        displayName: formatPersonName(member.person),
        shirtNumber: member.shirtNumber,
        responseId: response?.id ?? null,
        status,
        statusLabel: getParticipationStatusLabel(status),
        responseSource: response?.responseSource ?? null,
        responseSourceLabel: getParticipationResponseSourceLabel(response?.responseSource ?? null),
        note: response?.note ?? null,
        respondedAt: formatIsoDateTime(response?.respondedAt ?? null),
      };
    }),
  };
}

export async function getParticipationSummary(
  tenantId: string,
  teamSeasonId: string,
  event: ParticipationEventRef,
) {
  const data = await getParticipationForEvent(tenantId, teamSeasonId, event);
  return data.summary;
}

export async function listUpcomingParticipationEvents(
  tenantId: string,
  teamSeasonId: string,
  teamId: string,
  options?: { limit?: number; from?: Date },
): Promise<UpcomingParticipationEvent[]> {
  const from = options?.from ?? new Date();
  const limit = options?.limit ?? 10;

  const [trainingSessions, calendarEvents] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        tenantId,
        teamSeasonId,
        status: "SCHEDULED",
        startAt: { gte: from },
      },
      select: {
        id: true,
        startAt: true,
        trainingSeries: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [{ startAt: "asc" }],
      take: limit,
    }),
    prisma.event.findMany({
      where: {
        tenantId,
        teamId,
        type: { in: ["MATCH", "TOURNAMENT"] },
        startAt: { gte: from },
      },
      select: {
        id: true,
        type: true,
        title: true,
        startAt: true,
      },
      orderBy: [{ startAt: "asc" }],
      take: limit,
    }),
  ]);

  const options_: UpcomingParticipationEvent[] = [
    ...trainingSessions.map((session) => ({
      eventKind: "TRAINING" as const,
      trainingSessionId: session.id,
      title: session.trainingSeries.title,
      date: formatDateKey(session.startAt),
      eventKindLabel: getParticipationEventKindLabel("TRAINING"),
    })),
    ...calendarEvents.map((calendarEvent) => ({
      eventKind: calendarEvent.type as "MATCH" | "TOURNAMENT",
      eventId: calendarEvent.id,
      title: calendarEvent.title,
      date: formatDateKey(calendarEvent.startAt),
      eventKindLabel: getParticipationEventKindLabel(
        calendarEvent.type as AttendanceEventKind,
      ),
    })),
  ];

  return options_
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export async function getUpcomingParticipationForTeam(
  tenantId: string,
  teamSeasonId: string,
  teamId: string,
): Promise<TeamUpcomingParticipation> {
  const events = await listUpcomingParticipationEvents(tenantId, teamSeasonId, teamId);
  return { teamSeasonId, events };
}

export async function getMyUpcomingParticipationRequests(
  tenantId: string,
  personIds: string[],
): Promise<MyParticipationRequest[]> {
  if (personIds.length === 0) {
    return [];
  }

  const now = new Date();

  const squadMemberships = await prisma.playerSquadMember.findMany({
    where: {
      personId: { in: personIds },
      teamSeason: {
        team: { tenantId },
        status: "ACTIVE",
      },
    },
    select: {
      personId: true,
      teamSeasonId: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      teamSeason: {
        select: {
          displayName: true,
          teamId: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const requests: MyParticipationRequest[] = [];

  for (const membership of squadMemberships) {
    const events = await listUpcomingParticipationEvents(
      tenantId,
      membership.teamSeasonId,
      membership.teamSeason.teamId,
      { limit: 5, from: now },
    );

    if (events.length === 0) {
      continue;
    }

    const responses = await prisma.participationResponse.findMany({
      where: {
        tenantId,
        personId: membership.personId,
        teamSeasonId: membership.teamSeasonId,
      },
      select: {
        status: true,
        note: true,
        respondedAt: true,
        responseSource: true,
        eventKind: true,
        trainingSessionId: true,
        eventId: true,
      },
    });

    const responseKey = (event: UpcomingParticipationEvent) =>
      event.eventKind === "TRAINING"
        ? `TRAINING:${event.trainingSessionId}`
        : `${event.eventKind}:${event.eventId}`;

    const responseByKey = new Map(
      responses.map((response) => [
        response.eventKind === "TRAINING"
          ? `TRAINING:${response.trainingSessionId}`
          : `${response.eventKind}:${response.eventId}`,
        response,
      ]),
    );

    for (const event of events) {
      const response = responseByKey.get(responseKey(event));
      const status = response?.status ?? "OPEN";

      requests.push({
        personId: membership.personId,
        personDisplayName: formatPersonName(membership.person),
        teamSeasonId: membership.teamSeasonId,
        teamDisplayName:
          membership.teamSeason.displayName || membership.teamSeason.team.name,
        event,
        status,
        statusLabel: getParticipationStatusLabel(status),
        note: response?.note ?? null,
        respondedAt: formatIsoDateTime(response?.respondedAt ?? null),
        responseSource: response?.responseSource ?? null,
        responseSourceLabel: getParticipationResponseSourceLabel(
          response?.responseSource ?? null,
        ),
      });
    }
  }

  return requests.sort((a, b) => a.event.date.localeCompare(b.event.date));
}
