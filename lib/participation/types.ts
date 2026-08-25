/**
 * lib/participation/types.ts
 *
 * TEAM-COCKPIT-03A — canonical participation response domain types.
 *
 * Event reference strategy mirrors AttendanceRecord / WeekplannerItem:
 *   TRAINING   → trainingSessionId
 *   MATCH      → eventId (Event.type = MATCH)
 *   TOURNAMENT → eventId (Event.type = TOURNAMENT)
 */

import type {
  AttendanceEventKind,
  ParticipationResponseSource,
  ParticipationResponseStatus,
} from "@prisma/client";

export type { AttendanceEventKind, ParticipationResponseSource, ParticipationResponseStatus };

export const PARTICIPATION_STATUSES = [
  "OPEN",
  "YES",
  "NO",
  "MAYBE",
] as const satisfies readonly ParticipationResponseStatus[];

export const PARTICIPATION_RESPONSE_SOURCES = [
  "PLAYER",
  "PARENT",
  "TRAINER",
  "STAFF",
] as const satisfies readonly ParticipationResponseSource[];

export type ParticipationEventRef =
  | { eventKind: "TRAINING"; trainingSessionId: string }
  | { eventKind: "MATCH"; eventId: string }
  | { eventKind: "TOURNAMENT"; eventId: string };

export type ParticipationResponseInput = {
  personId: string;
  teamSeasonId: string;
  event: ParticipationEventRef;
  status: ParticipationResponseStatus;
  note?: string | null;
  responseSource: ParticipationResponseSource;
};

export type ParticipationStatusCounts = {
  open: number;
  yes: number;
  no: number;
  maybe: number;
};

export type ParticipationSummary = {
  totalPlayers: number;
  counts: ParticipationStatusCounts;
};

export type PlayerParticipationEntry = {
  personId: string;
  displayName: string;
  shirtNumber: number | null;
  responseId: string | null;
  status: ParticipationResponseStatus;
  statusLabel: string;
  responseSource: ParticipationResponseSource | null;
  responseSourceLabel: string | null;
  note: string | null;
  respondedAt: string | null;
};

export type EventParticipationData = {
  event: ParticipationEventRef & {
    title: string;
    date: string;
    eventKindLabel: string;
  };
  summary: ParticipationSummary;
  players: PlayerParticipationEntry[];
};

export type UpcomingParticipationEvent = {
  eventKind: AttendanceEventKind;
  trainingSessionId?: string;
  eventId?: string;
  title: string;
  date: string;
  eventKindLabel: string;
};

export type TeamUpcomingParticipation = {
  teamSeasonId: string;
  events: UpcomingParticipationEvent[];
};

export type MyParticipationRequest = {
  personId: string;
  personDisplayName: string;
  teamSeasonId: string;
  teamDisplayName: string;
  event: UpcomingParticipationEvent;
  status: ParticipationResponseStatus;
  statusLabel: string;
  note: string | null;
  respondedAt: string | null;
  responseSource: ParticipationResponseSource | null;
  responseSourceLabel: string | null;
};
