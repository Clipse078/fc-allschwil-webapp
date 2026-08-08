/**
 * lib/tournaments/queries.ts
 *
 * Tenant-scoped read access to canonical `Event` rows with
 * `type: "TOURNAMENT"`. This is the single place TournamentCenter code
 * queries the database — no other module should filter Event by
 * `type: "TOURNAMENT"` with ad-hoc tenant scoping.
 *
 * Security invariant: every query is scoped by `tenantId` AND
 * `type: "TOURNAMENT"`, so a cross-tenant id — or an id belonging to a
 * MATCH/TRAINING/OTHER event — never resolves here.
 */

import { prisma } from "@/lib/db/prisma";
import type { EventStatus } from "@prisma/client";

export const tournamentEventSelect = {
  id: true,
  tenantId: true,
  title: true,
  description: true,
  status: true,
  source: true,
  reviewStage: true,
  startAt: true,
  endAt: true,
  meetingTime: true,
  location: true,
  organizerName: true,
  competitionLabel: true,
  resultLabel: true,
  remarks: true,
  websiteVisible: true,
  infoboardVisible: true,
  homepageVisible: true,
  wochenplanVisible: true,
  teamPageVisible: true,
  pitchCode: true,
  homeDressingRoomCode: true,
  awayDressingRoomCode: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
  team: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
    },
  },
} as const;

export type TournamentEventRow = NonNullable<
  Awaited<ReturnType<typeof findTournamentEventById>>
>;

export function findTournamentEventById(tenantId: string, tournamentId: string) {
  return prisma.event.findFirst({
    where: { id: tournamentId, tenantId, type: "TOURNAMENT" },
    select: tournamentEventSelect,
  });
}

export function findAllTournamentEvents(
  tenantId: string,
  filter: { status?: EventStatus[] } = {},
) {
  return prisma.event.findMany({
    where: {
      tenantId,
      type: "TOURNAMENT",
      ...(filter.status && filter.status.length > 0
        ? { status: { in: filter.status } }
        : {}),
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    select: tournamentEventSelect,
  });
}
