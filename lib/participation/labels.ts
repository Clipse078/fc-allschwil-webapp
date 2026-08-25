/**
 * lib/participation/labels.ts
 *
 * German user-facing labels for participation statuses and response sources.
 */

import type {
  AttendanceEventKind,
  ParticipationResponseSource,
  ParticipationResponseStatus,
} from "@prisma/client";

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationResponseStatus, string> = {
  OPEN: "Offen",
  YES: "Dabei",
  NO: "Abwesend",
  MAYBE: "Unsicher",
};

export const PARTICIPATION_RESPONSE_SOURCE_LABELS: Record<ParticipationResponseSource, string> = {
  PLAYER: "Spieler",
  PARENT: "Eltern",
  TRAINER: "Trainer",
  STAFF: "Staff",
};

export const PARTICIPATION_EVENT_KIND_LABELS: Record<AttendanceEventKind, string> = {
  TRAINING: "Training",
  MATCH: "Spiel",
  TOURNAMENT: "Turnier",
};

export function getParticipationStatusLabel(status: ParticipationResponseStatus): string {
  return PARTICIPATION_STATUS_LABELS[status];
}

export function getParticipationResponseSourceLabel(
  source: ParticipationResponseSource | null,
): string | null {
  if (!source) {
    return null;
  }
  return PARTICIPATION_RESPONSE_SOURCE_LABELS[source];
}

export function getParticipationEventKindLabel(eventKind: AttendanceEventKind): string {
  return PARTICIPATION_EVENT_KIND_LABELS[eventKind];
}

export function formatParticipationSummaryLine(summary: {
  totalPlayers: number;
  counts: { yes: number; no: number; maybe: number; open: number };
}): string {
  const parts = [`${summary.totalPlayers} Spieler`];
  if (summary.counts.yes > 0) parts.push(`${summary.counts.yes} dabei`);
  if (summary.counts.no > 0) parts.push(`${summary.counts.no} abwesend`);
  if (summary.counts.maybe > 0) parts.push(`${summary.counts.maybe} unsicher`);
  if (summary.counts.open > 0) parts.push(`${summary.counts.open} offen`);
  return parts.join(" · ");
}
