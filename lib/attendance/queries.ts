/**
 * lib/attendance/queries.ts
 *
 * TEAM-COCKPIT-02B — read models for Team Cockpit and future Personen views.
 */

import type { AttendanceEventKind, AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAttendanceEventKindLabel, getAttendanceStatusLabel } from "./labels";
import {
  calculateAttendancePercentage,
  countStatuses,
  formatAttendancePercentage,
} from "./statistics";
import { resolveAttendanceEventContext } from "./event-reference";
import type {
  AttendanceEventRef,
  EventAttendanceSheetData,
  PlayerAttendanceHistoryEntry,
  PlayerAttendanceSummary,
  TeamAttendanceOverview,
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

export async function getTeamAttendanceOverview(
  tenantId: string,
  teamSeasonId: string,
): Promise<TeamAttendanceOverview> {
  const squadMembers = await prisma.playerSquadMember.findMany({
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
  });

  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      teamSeasonId,
    },
    select: {
      personId: true,
      status: true,
    },
  });

  const statusesByPerson = new Map<string, AttendanceStatus[]>();
  for (const record of records) {
    const existing = statusesByPerson.get(record.personId) ?? [];
    existing.push(record.status);
    statusesByPerson.set(record.personId, existing);
  }

  const players: PlayerAttendanceSummary[] = squadMembers.map((member) => {
    const statuses = statusesByPerson.get(member.personId) ?? [];
    const counts = countStatuses(statuses);
    const percentage = calculateAttendancePercentage(counts);

    return {
      personId: member.personId,
      displayName: formatPersonName(member.person),
      shirtNumber: member.shirtNumber,
      eventCount: statuses.length,
      counts,
      percentage,
      percentageLabel: formatAttendancePercentage(percentage),
    };
  });

  return {
    teamSeasonId,
    players,
  };
}

export async function getPlayerAttendanceHistory(
  tenantId: string,
  teamSeasonId: string,
  personId: string,
): Promise<PlayerAttendanceHistoryEntry[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      teamSeasonId,
      personId,
      teamSeason: {
        team: { tenantId },
      },
      person: {
        tenantId,
      },
    },
    select: {
      id: true,
      status: true,
      note: true,
      eventKind: true,
      trainingSessionId: true,
      eventId: true,
      createdAt: true,
      trainingSession: {
        select: {
          startAt: true,
          trainingSeries: {
            select: {
              title: true,
            },
          },
        },
      },
      event: {
        select: {
          title: true,
          startAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return records.map((record) => {
    const date =
      record.eventKind === "TRAINING"
        ? record.trainingSession?.startAt ?? record.createdAt
        : record.event?.startAt ?? record.createdAt;
    const title =
      record.eventKind === "TRAINING"
        ? record.trainingSession?.trainingSeries.title ?? "Training"
        : record.event?.title ?? getAttendanceEventKindLabel(record.eventKind);

    return {
      id: record.id,
      date: formatDateKey(date),
      eventKind: record.eventKind,
      eventKindLabel: getAttendanceEventKindLabel(record.eventKind),
      eventTitle: title,
      status: record.status,
      statusLabel: getAttendanceStatusLabel(record.status),
      note: record.note,
    };
  });
}

export async function getEventAttendanceSheet(
  tenantId: string,
  teamSeasonId: string,
  event: AttendanceEventRef,
): Promise<EventAttendanceSheetData> {
  const eventContext = await resolveAttendanceEventContext(tenantId, teamSeasonId, event);

  const [squadMembers, records] = await Promise.all([
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
    prisma.attendanceRecord.findMany({
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
      },
    }),
  ]);

  const recordByPerson = new Map(records.map((record) => [record.personId, record]));

  return {
    event: {
      ...event,
      title: eventContext.title,
      date: formatDateKey(eventContext.date),
      eventKindLabel: getAttendanceEventKindLabel(eventContext.eventKind),
    },
    entries: squadMembers.map((member) => {
      const record = recordByPerson.get(member.personId);
      return {
        personId: member.personId,
        displayName: formatPersonName(member.person),
        shirtNumber: member.shirtNumber,
        recordId: record?.id ?? null,
        status: record?.status ?? "OPEN",
        note: record?.note ?? null,
      };
    }),
  };
}

export type AttendanceEventOption = {
  eventKind: AttendanceEventKind;
  trainingSessionId?: string;
  eventId?: string;
  title: string;
  date: string;
  eventKindLabel: string;
};

export async function listAttendanceEventOptions(
  tenantId: string,
  teamSeasonId: string,
  teamId: string,
): Promise<AttendanceEventOption[]> {
  const teamSeason = await prisma.teamSeason.findFirst({
    where: {
      id: teamSeasonId,
      teamId,
      team: { tenantId },
    },
    select: { seasonId: true },
  });

  if (!teamSeason) {
    return [];
  }

  const [trainingSessions, calendarEvents] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        tenantId,
        teamSeasonId,
        status: "SCHEDULED",
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
      orderBy: [{ startAt: "desc" }],
      take: 20,
    }),
    prisma.event.findMany({
      where: {
        tenantId,
        teamId,
        seasonId: teamSeason.seasonId,
        type: { in: ["MATCH", "TOURNAMENT"] },
      },
      select: {
        id: true,
        type: true,
        title: true,
        startAt: true,
      },
      orderBy: [{ startAt: "desc" }],
      take: 20,
    }),
  ]);

  const options: AttendanceEventOption[] = [
    ...trainingSessions.map((session) => ({
      eventKind: "TRAINING" as const,
      trainingSessionId: session.id,
      title: session.trainingSeries.title,
      date: formatDateKey(session.startAt),
      eventKindLabel: getAttendanceEventKindLabel("TRAINING"),
    })),
    ...calendarEvents.map((calendarEvent) => ({
      eventKind: calendarEvent.type as "MATCH" | "TOURNAMENT",
      eventId: calendarEvent.id,
      title: calendarEvent.title,
      date: formatDateKey(calendarEvent.startAt),
      eventKindLabel: getAttendanceEventKindLabel(calendarEvent.type as "MATCH" | "TOURNAMENT"),
    })),
  ];

  return options.sort((a, b) => b.date.localeCompare(a.date));
}

/** Future Personen -> Spieler -> Anwesenheit read path. */
export async function getPersonAttendanceHistory(
  tenantId: string,
  personId: string,
): Promise<PlayerAttendanceHistoryEntry[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      personId,
      person: { tenantId },
    },
    select: {
      id: true,
      status: true,
      note: true,
      eventKind: true,
      createdAt: true,
      trainingSession: {
        select: {
          startAt: true,
          trainingSeries: {
            select: {
              title: true,
            },
          },
        },
      },
      event: {
        select: {
          title: true,
          startAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return records.map((record) => {
    const date =
      record.eventKind === "TRAINING"
        ? record.trainingSession?.startAt ?? record.createdAt
        : record.event?.startAt ?? record.createdAt;
    const title =
      record.eventKind === "TRAINING"
        ? record.trainingSession?.trainingSeries.title ?? "Training"
        : record.event?.title ?? getAttendanceEventKindLabel(record.eventKind);

    return {
      id: record.id,
      date: formatDateKey(date),
      eventKind: record.eventKind,
      eventKindLabel: getAttendanceEventKindLabel(record.eventKind),
      eventTitle: title,
      status: record.status,
      statusLabel: getAttendanceStatusLabel(record.status),
      note: record.note,
    };
  });
}

export async function getPersonAttendanceStatistics(tenantId: string, personId: string) {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      personId,
      person: { tenantId },
    },
    select: {
      status: true,
    },
  });

  const counts = countStatuses(records.map((record) => record.status));
  const percentage = calculateAttendancePercentage(counts);

  return {
    eventCount: records.length,
    counts,
    percentage,
    percentageLabel: formatAttendancePercentage(percentage),
  };
}
