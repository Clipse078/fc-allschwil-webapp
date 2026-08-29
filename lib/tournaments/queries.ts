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
import type { EventStatus, Prisma } from "@prisma/client";

/** Shared team reference select — mirrors TournamentTeamReference. */
const teamReferenceSelect = {
  id: true,
  name: true,
  slug: true,
  category: true,
  genderGroup: true,
  ageGroup: true,
} as const;

/** Shared FacilityResource(+Facility) reference select — mirrors TournamentFacilityResourceFields. */
const facilityResourceReferenceSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  facilityId: true,
  facility: { select: { name: true } },
} as const;

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
  homeAway: true,
  websiteVisible: true,
  infoboardVisible: true,
  homepageVisible: true,
  wochenplanVisible: true,
  teamPageVisible: true,
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
    select: teamReferenceSelect,
  },
  // TOURNAMENTCENTER-01B — canonical multi-team participation and
  // tournament-level facility allocations. See lib/tournaments/types.ts /
  // tournament-service.ts for the DTO mapping.
  tournamentParticipants: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      eventId: true,
      teamId: true,
      externalTeamId: true,
      externalClubId: true,
      displayName: true,
      manualLabel: true,
      displayOrder: true,
      createdAt: true,
      updatedAt: true,
      team: { select: teamReferenceSelect },
      externalTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          categoryLabel: true,
          logoUrl: true,
          externalClub: {
            select: { id: true, name: true, shortName: true, logoUrl: true },
          },
        },
      },
      externalClub: {
        select: { id: true, name: true, shortName: true, logoUrl: true },
      },
      dressingRoomAllocations: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          notes: true,
          displayOrder: true,
          facilityResource: { select: facilityResourceReferenceSelect },
        },
      },
    },
  },
  tournamentResourceAllocations: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      notes: true,
      displayOrder: true,
      facilityResource: { select: facilityResourceReferenceSelect },
    },
  },
  // `satisfies` (not `as const`) — the nested `orderBy` arrays above must
  // stay ordinary mutable arrays to match Prisma's *OrderByWithRelationInput[]
  // types; `as const` on this outer object would make them readonly tuples
  // and fail to typecheck, while still validating every field/literal
  // against the real Prisma.EventSelect shape.
} satisfies Prisma.EventSelect;

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
